/**
 * Fail when Convex functions in `convex/` skip `args` or `returns` validators.
 *
 * ESLint already enforces `args` via `@convex-dev/require-args-validator`.
 * This script also requires `returns` on every registered function.
 *
 * Files are parsed with the TypeScript compiler API, so comments, strings,
 * template literals and regular-expression literals cannot confuse the check.
 * Source: https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API
 */
import { readdir, readFile } from 'node:fs/promises';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['_generated', 'node_modules']);
/**
 * Extensions the Convex CLI bundles as function modules, mapped to the parser
 * flavor TypeScript needs. Source: `ENTRY_POINT_EXTENSIONS` in
 * `convex/dist/cli.bundle.cjs`.
 */
const SCRIPT_KIND_BY_EXTENSION = new Map([
  ['.ts', ts.ScriptKind.TS],
  ['.mts', ts.ScriptKind.TS],
  ['.cts', ts.ScriptKind.TS],
  ['.tsx', ts.ScriptKind.TSX],
  ['.js', ts.ScriptKind.JS],
  ['.mjs', ts.ScriptKind.JS],
  ['.cjs', ts.ScriptKind.JS],
  ['.jsx', ts.ScriptKind.JSX],
]);
const REGISTRAR_NAMES = new Set([
  'query',
  'mutation',
  'action',
  'internalQuery',
  'internalMutation',
  'internalAction',
]);
const MISSING_ARGS = 'Convex function is missing an `args` validator.';
const MISSING_RETURNS = 'Convex function is missing a `returns` validator.';

/**
 * @typedef {{ file: string; line: number; message: string }} ValidatorFinding
 */

/**
 * Scan one Convex source file for missing args or returns on registered functions.
 *
 * Convex registers every exported binding whose value is `<registrar>(...)`
 * (a default export maps to the module path, see `server/api.js`). The scan
 * therefore covers `export const name = query(...)`,
 * `export default query(...)`, and locals exported later through
 * `export default name`, `export const other = name`, or
 * `export { name, name as other }`. Registrars imported under an alias
 * (`import { query as q }`) or through a namespace (`server.query`) are
 * recognized, also when wrapped in parentheses, `as`, `satisfies` or `!`.
 * The check is name-based: any module that exports a `query` (for example a
 * convex-helpers `customQuery` builder, which passes `args` and `returns`
 * through) is held to the same rule. Builders under other names
 * (`authedQuery(...)`) are outside this check. The options must be an inline
 * object literal; any other first argument (a handler callback, a variable)
 * reports both validators as missing.
 *
 * @param {{ relativePath: string; contents: string }} params Path and file text
 * @returns {{ findings: ValidatorFinding[] }}
 */
export function scanConvexValidators({ relativePath, contents }) {
  /** @type {ValidatorFinding[]} */
  const findings = [];
  const normalized = relativePath.replaceAll('\\', '/');

  if (normalized.includes('_generated/')) {
    return { findings };
  }

  const sourceFile = ts.createSourceFile(
    normalized,
    contents,
    ts.ScriptTarget.Latest,
    true,
    SCRIPT_KIND_BY_EXTENSION.get(extname(normalized)) ?? ts.ScriptKind.TS,
  );

  const { registrars } = getRegistrars({ sourceFile });

  /**
   * Top-level bindings that hold `<registrar>(...)`, exported or not, from
   * declarations (`const name = query(...)`), later assignments
   * (`let name; name = query(...)`), and `other = name` aliases of them, so
   * `export { name }`, `export default name`, `export const x = name` and
   * `export let name` can be traced back to the call.
   * @type {Map<string, { call: import('typescript').CallExpression; node: import('typescript').Node }>}
   */
  const localRegistrars = new Map();
  /**
   * @param {{ name: string; value: import('typescript').Expression; node: import('typescript').Node }} params
   *   Binding name, the expression stored in it, and the statement for line numbers
   */
  const recordLocal = ({ name, value, node }) => {
    const { call } = getRegistrarCall({ expression: value, registrars });
    if (call) {
      localRegistrars.set(name, { call, node });
    } else if (ts.isIdentifier(value)) {
      const aliased = localRegistrars.get(value.text);
      if (aliased) {
        localRegistrars.set(name, aliased);
      }
    }
  };
  for (const statement of sourceFile.statements) {
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (declaration.initializer && ts.isIdentifier(declaration.name)) {
          recordLocal({
            name: declaration.name.text,
            value: declaration.initializer,
            node: statement,
          });
        }
      }
    } else if (
      ts.isExpressionStatement(statement) &&
      ts.isBinaryExpression(statement.expression) &&
      statement.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(statement.expression.left)
    ) {
      // `name = query(...)` after `let name;`
      recordLocal({
        name: statement.expression.left.text,
        value: statement.expression.right,
        node: statement,
      });
    }
  }

  /** Calls already reported, so a double export does not double-report. */
  const checked = new Set();
  /**
   * @param {{ call: import('typescript').CallExpression; node: import('typescript').Node }} params
   */
  const check = ({ call, node }) => {
    if (checked.has(call)) {
      return;
    }
    checked.add(call);
    const line =
      sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line +
      1;
    const { names } = getOptionsPropertyNames({ call });
    if (!names.has('args')) {
      findings.push({ file: normalized, line, message: MISSING_ARGS });
    }
    if (!names.has('returns')) {
      findings.push({ file: normalized, line, message: MISSING_RETURNS });
    }
  };
  /** @param {string} name Local binding name */
  const checkLocal = (name) => {
    const entry = localRegistrars.get(name);
    if (entry) {
      check(entry);
    }
  };

  for (const statement of sourceFile.statements) {
    if (ts.isVariableStatement(statement) && isExported(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        const initializer = declaration.initializer;
        if (!initializer) {
          // `export let name;` filled by a later `name = query(...)`.
          if (ts.isIdentifier(declaration.name)) {
            checkLocal(declaration.name.text);
          }
          continue;
        }
        const { call } = getRegistrarCall({
          expression: initializer,
          registrars,
        });
        if (call) {
          check({ call, node: statement });
        } else if (ts.isIdentifier(initializer)) {
          checkLocal(initializer.text);
        }
      }
    } else if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
      const { expression } = statement;
      const { call } = getRegistrarCall({ expression, registrars });
      if (call) {
        check({ call, node: statement });
      } else if (ts.isIdentifier(expression)) {
        checkLocal(expression.text);
      }
    } else if (
      ts.isExportDeclaration(statement) &&
      !statement.moduleSpecifier &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const element of statement.exportClause.elements) {
        checkLocal((element.propertyName ?? element.name).text);
      }
    }
  }

  return { findings };
}

/**
 * Whether a statement carries the `export` modifier.
 *
 * @param {import('typescript').Statement} statement AST statement
 * @returns {boolean}
 */
function isExported(statement) {
  const modifiers = ts.canHaveModifiers(statement)
    ? ts.getModifiers(statement)
    : undefined;
  return (
    modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    ) ?? false
  );
}

/**
 * @typedef {{ names: Set<string>; namespaces: Set<string> }} Registrars
 *   `names`: local identifiers that are a registrar (canonical names plus
 *   aliases from `import { query as q }`). `namespaces`: locals bound by
 *   `import * as server`, so `server.query(...)` is a registrar call.
 */

/**
 * Collect how this file can spell a Convex registrar.
 *
 * @param {{ sourceFile: import('typescript').SourceFile }} params Parsed file
 * @returns {{ registrars: Registrars }}
 */
function getRegistrars({ sourceFile }) {
  /** @type {Registrars} */
  const registrars = { names: new Set(REGISTRAR_NAMES), namespaces: new Set() };
  for (const statement of sourceFile.statements) {
    const bindings = ts.isImportDeclaration(statement)
      ? statement.importClause?.namedBindings
      : undefined;
    if (!bindings) {
      continue;
    }
    if (ts.isNamespaceImport(bindings)) {
      registrars.namespaces.add(bindings.name.text);
      continue;
    }
    for (const element of bindings.elements) {
      const imported = (element.propertyName ?? element.name).text;
      if (REGISTRAR_NAMES.has(imported)) {
        registrars.names.add(element.name.text);
      }
    }
  }
  return { registrars };
}

/**
 * Return the registrar call inside an expression, looking through
 * transparent wrappers: parentheses, `as`, `satisfies`, `<T>` assertions and
 * non-null `!`. Accepts `query(...)`, an aliased `q(...)`, and a namespace
 * member `server.query(...)`.
 *
 * @param {{ expression: import('typescript').Expression; registrars: Registrars }} params
 *   Candidate expression and the registrar spellings valid in its file
 * @returns {{ call: import('typescript').CallExpression | undefined }}
 */
function getRegistrarCall({ expression, registrars }) {
  let inner = expression;
  while (
    ts.isParenthesizedExpression(inner) ||
    ts.isAsExpression(inner) ||
    ts.isSatisfiesExpression(inner) ||
    ts.isTypeAssertionExpression(inner) ||
    ts.isNonNullExpression(inner)
  ) {
    inner = inner.expression;
  }
  if (!ts.isCallExpression(inner)) {
    return { call: undefined };
  }
  const callee = inner.expression;
  if (ts.isIdentifier(callee) && registrars.names.has(callee.text)) {
    return { call: inner };
  }
  if (
    ts.isPropertyAccessExpression(callee) &&
    ts.isIdentifier(callee.expression) &&
    registrars.namespaces.has(callee.expression.text) &&
    REGISTRAR_NAMES.has(callee.name.text)
  ) {
    return { call: inner };
  }
  return { call: undefined };
}

/**
 * Collect the top-level property names of a registrar's options object.
 *
 * Returns an empty set when the first argument is not an object literal, so
 * function-form registrars report both validators as missing.
 *
 * @param {{ call: import('typescript').CallExpression }} params Registrar call
 * @returns {{ names: Set<string> }}
 */
export function getOptionsPropertyNames({ call }) {
  /** @type {Set<string>} */
  const names = new Set();
  const options = call.arguments[0];

  if (!options || !ts.isObjectLiteralExpression(options)) {
    return { names };
  }

  for (const property of options.properties) {
    if (ts.isSpreadAssignment(property) || !property.name) {
      continue;
    }
    const name = property.name;
    if (ts.isComputedPropertyName(name)) {
      // `["args"]` counts; `[someVariable]` does not, its value is unknown.
      const key = name.expression;
      if (
        ts.isStringLiteral(key) ||
        ts.isNoSubstitutionTemplateLiteral(key) ||
        ts.isNumericLiteral(key)
      ) {
        names.add(key.text);
      }
    } else if (
      ts.isIdentifier(name) ||
      ts.isStringLiteral(name) ||
      ts.isNumericLiteral(name)
    ) {
      names.add(name.text);
    }
  }

  return { names };
}

/**
 * Walk `convex/` and collect validator findings.
 *
 * @param {{ root: string }} params Repo root
 * @returns {Promise<{ findings: ValidatorFinding[] }>}
 */
export async function scanConvexDirectory({ root }) {
  const dir = join(root, 'convex');
  /** @type {ValidatorFinding[]} */
  const findings = [];

  async function walk(currentDir) {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) {
          continue;
        }
        await walk(join(currentDir, entry.name));
        continue;
      }

      if (
        !entry.isFile() ||
        !SCRIPT_KIND_BY_EXTENSION.has(extname(entry.name))
      ) {
        continue;
      }

      const filePath = join(currentDir, entry.name);
      const relativePath = relative(root, filePath);
      const contents = await readFile(filePath, 'utf8');
      const { findings: fileFindings } = scanConvexValidators({
        relativePath,
        contents,
      });
      findings.push(...fileFindings);
    }
  }

  await walk(dir);
  return { findings };
}

const isMain =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const { findings } = await scanConvexDirectory({ root: ROOT });
  for (const finding of findings) {
    process.stderr.write(
      `${finding.file}:${finding.line}: ${finding.message}\n`,
    );
  }
  if (findings.length > 0) {
    process.exitCode = 1;
  }
}

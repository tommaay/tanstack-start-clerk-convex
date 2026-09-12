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
 * A registered function is `export const name = <registrar>(...)`. The options
 * must be an inline object literal; any other first argument (a handler
 * callback, a variable) reports both validators as missing.
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

  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement) || !isExported(statement)) {
      continue;
    }

    for (const declaration of statement.declarationList.declarations) {
      const call = declaration.initializer;
      if (!call || !isRegistrarCall(call)) {
        continue;
      }

      const line =
        sourceFile.getLineAndCharacterOfPosition(statement.getStart(sourceFile))
          .line + 1;
      const { names } = getOptionsPropertyNames({ call });

      if (!names.has('args')) {
        findings.push({ file: normalized, line, message: MISSING_ARGS });
      }
      if (!names.has('returns')) {
        findings.push({ file: normalized, line, message: MISSING_RETURNS });
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
 * Whether an expression is a call to a Convex registrar such as `query(...)`.
 *
 * @param {import('typescript').Expression} expression Initializer expression
 * @returns {expression is import('typescript').CallExpression}
 */
function isRegistrarCall(expression) {
  return (
    ts.isCallExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    REGISTRAR_NAMES.has(expression.expression.text)
  );
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
    if (ts.isSpreadAssignment(property)) {
      continue;
    }
    const name = property.name;
    if (
      name &&
      (ts.isIdentifier(name) ||
        ts.isStringLiteral(name) ||
        ts.isNumericLiteral(name))
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

/**
 * Fail when Convex functions in `convex/` skip `args` or `returns` validators.
 *
 * ESLint already enforces `args` via `@convex-dev/require-args-validator`.
 * This script also requires `returns` on every registered function.
 */
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['_generated', 'node_modules']);
/** Returned when a function-form registrar passes a direct handler callback. */
const DIRECT_CALLBACK_FORM = -2;
const REGISTRAR_NAME_RE =
  /export\s+const\s+\w+\s*=\s*(internal(?:Query|Mutation|Action)|query|mutation|action)\b/g;

/**
 * @typedef {{ file: string; line: number; message: string }} ValidatorFinding
 */

/**
 * Scan one Convex source file for missing args or returns on registered functions.
 *
 * @param {{ relativePath: string; contents: string }} params Path and file text
 * @returns {{ findings: ValidatorFinding[] }}
 */
export function scanConvexValidators({ relativePath, contents }) {
  const findings = [];
  const normalized = relativePath.replaceAll('\\', '/');

  if (normalized.includes('_generated/')) {
    return { findings };
  }

  for (const match of contents.matchAll(REGISTRAR_NAME_RE)) {
    const line = contents.slice(0, match.index).split('\n').length;
    const registrarEnd = (match.index ?? 0) + match[0].length;
    const openParenIndex = findNextCharIndex({
      contents,
      startIndex: registrarEnd,
      char: '(',
    });
    if (openParenIndex < 0) {
      continue;
    }

    const objectStart = findRegistrarOptionsObject({
      contents,
      openParenIndex,
    });
    if (objectStart === DIRECT_CALLBACK_FORM) {
      findings.push({
        file: normalized,
        line,
        message: 'Convex function is missing an `args` validator.',
      });
      findings.push({
        file: normalized,
        line,
        message: 'Convex function is missing a `returns` validator.',
      });
      continue;
    }
    if (objectStart < 0) {
      continue;
    }

    const objectText = readBalancedObject({
      contents,
      openBraceIndex: objectStart,
    });
    if (!objectText) {
      continue;
    }

    const propertyNames = getTopLevelPropertyNames({ objectText });

    if (!propertyNames.has('args')) {
      findings.push({
        file: normalized,
        line,
        message: 'Convex function is missing an `args` validator.',
      });
    }

    if (!propertyNames.has('returns')) {
      findings.push({
        file: normalized,
        line,
        message: 'Convex function is missing a `returns` validator.',
      });
    }
  }

  return { findings };
}

/**
 * Find the next `{` outside comments and string literals.
 *
 * @param {{ contents: string; startIndex: number }} params Source text and search start
 * @returns {number} Index of the brace, or `-1` when none is found
 */
export function findNextObjectBraceIndex({ contents, startIndex }) {
  return findNextCharIndex({ contents, startIndex, char: '{' });
}

/**
 * Find the registrar options object for object-form and function-form calls.
 *
 * @param {{ contents: string; openParenIndex: number }} params Source text and `(` index
 * @returns {number} Index of the options `{`, or `-1`
 */
export function findRegistrarOptionsObject({ contents, openParenIndex }) {
  const argsStart = skipWhitespaceAndComments({
    contents,
    startIndex: openParenIndex + 1,
  });
  const rest = contents.slice(argsStart);
  if (rest.startsWith('async') || rest.startsWith('function')) {
    const arrowIndex = findNextArrowToken({ contents, startIndex: argsStart });
    if (arrowIndex < 0) {
      return -1;
    }
    const afterArrow = skipWhitespaceAndComments({
      contents,
      startIndex: arrowIndex + 2,
    });
    if (contents[afterArrow] === '{') {
      return DIRECT_CALLBACK_FORM;
    }
    if (contents[afterArrow] === '(') {
      return findNextObjectBraceIndex({
        contents,
        startIndex: afterArrow,
      });
    }
    return -1;
  }

  return findNextObjectBraceIndex({ contents, startIndex: openParenIndex });
}

/**
 * Find the next `=>` token outside comments and string literals.
 *
 * @param {{ contents: string; startIndex: number }} params Source text and search start
 * @returns {number} Index of `=>`, or `-1`
 */
export function findNextArrowToken({ contents, startIndex }) {
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;
  let escaped = false;

  for (let i = startIndex; i < contents.length - 1; i += 1) {
    const ch = contents[i];
    const next = contents[i + 1];

    if (inLineComment) {
      if (ch === '\n') {
        inLineComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }

    if (escaped) {
      escaped = false;
      continue;
    }

    if ((inSingle || inDouble || inTemplate) && ch === '\\') {
      escaped = true;
      continue;
    }

    if (inSingle) {
      if (ch === "'") {
        inSingle = false;
      }
      continue;
    }

    if (inDouble) {
      if (ch === '"') {
        inDouble = false;
      }
      continue;
    }

    if (inTemplate) {
      if (ch === '`') {
        inTemplate = false;
      }
      continue;
    }

    if (ch === '/' && next === '/') {
      inLineComment = true;
      i += 1;
      continue;
    }

    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i += 1;
      continue;
    }

    if (ch === "'") {
      inSingle = true;
      continue;
    }

    if (ch === '"') {
      inDouble = true;
      continue;
    }

    if (ch === '`') {
      inTemplate = true;
      continue;
    }

    if (ch === '=' && next === '>') {
      return i;
    }
  }

  return -1;
}

/**
 * Skip whitespace and comments, returning the next source index.
 *
 * @param {{ contents: string; startIndex: number }} params Source text and search start
 * @returns {number}
 */
export function skipWhitespaceAndComments({ contents, startIndex }) {
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;
  let escaped = false;

  for (let i = startIndex; i < contents.length; i += 1) {
    const ch = contents[i];
    const next = contents[i + 1];

    if (inLineComment) {
      if (ch === '\n') {
        inLineComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }

    if (escaped) {
      escaped = false;
      continue;
    }

    if ((inSingle || inDouble || inTemplate) && ch === '\\') {
      escaped = true;
      continue;
    }

    if (inSingle) {
      if (ch === "'") {
        inSingle = false;
      }
      continue;
    }

    if (inDouble) {
      if (ch === '"') {
        inDouble = false;
      }
      continue;
    }

    if (inTemplate) {
      if (ch === '`') {
        inTemplate = false;
      }
      continue;
    }

    if (ch === '/' && next === '/') {
      inLineComment = true;
      i += 1;
      continue;
    }

    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i += 1;
      continue;
    }

    if (ch === "'") {
      inSingle = true;
      continue;
    }

    if (ch === '"') {
      inDouble = true;
      continue;
    }

    if (ch === '`') {
      inTemplate = true;
      continue;
    }

    if (/\s/.test(ch)) {
      continue;
    }

    return i;
  }

  return contents.length;
}

/**
 * Find the next character outside comments and string literals.
 *
 * @param {{ contents: string; startIndex: number; char: string }} params Source text and target char
 * @returns {number} Index of the character, or `-1`
 */
export function findNextCharIndex({ contents, startIndex, char }) {
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;
  let escaped = false;

  for (let i = startIndex; i < contents.length; i += 1) {
    const ch = contents[i];
    const next = contents[i + 1];

    if (inLineComment) {
      if (ch === '\n') {
        inLineComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }

    if (escaped) {
      escaped = false;
      continue;
    }

    if ((inSingle || inDouble || inTemplate) && ch === '\\') {
      escaped = true;
      continue;
    }

    if (inSingle) {
      if (ch === "'") {
        inSingle = false;
      }
      continue;
    }

    if (inDouble) {
      if (ch === '"') {
        inDouble = false;
      }
      continue;
    }

    if (inTemplate) {
      if (ch === '`') {
        inTemplate = false;
      }
      continue;
    }

    if (ch === '/' && next === '/') {
      inLineComment = true;
      i += 1;
      continue;
    }

    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i += 1;
      continue;
    }

    if (ch === "'") {
      inSingle = true;
      continue;
    }

    if (ch === '"') {
      inDouble = true;
      continue;
    }

    if (ch === '`') {
      inTemplate = true;
      continue;
    }

    if (ch === char) {
      return i;
    }
  }

  return -1;
}

/**
 * Read a balanced `{ ... }` block starting at the opening brace.
 *
 * @param {{ contents: string; openBraceIndex: number }} params File text and `{` index
 * @returns {string | null}
 */
function readBalancedObject({ contents, openBraceIndex }) {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;
  let escaped = false;

  for (let i = openBraceIndex; i < contents.length; i += 1) {
    const ch = contents[i];
    const next = contents[i + 1];

    if (inLineComment) {
      if (ch === '\n') {
        inLineComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }

    if (escaped) {
      escaped = false;
      continue;
    }
    if ((inSingle || inDouble || inTemplate) && ch === '\\') {
      escaped = true;
      continue;
    }
    if (inSingle) {
      if (ch === "'") {
        inSingle = false;
      }
      continue;
    }
    if (inDouble) {
      if (ch === '"') {
        inDouble = false;
      }
      continue;
    }
    if (inTemplate) {
      if (ch === '`') {
        inTemplate = false;
      }
      continue;
    }
    if (ch === '/' && next === '/') {
      inLineComment = true;
      i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i += 1;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      continue;
    }
    if (ch === '`') {
      inTemplate = true;
      continue;
    }
    if (ch === '{') {
      depth += 1;
      continue;
    }
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return contents.slice(openBraceIndex, i + 1);
      }
    }
  }

  return null;
}

/**
 * Collect top-level property names from a `{ ... }` object literal text block.
 *
 * @param {{ objectText: string }} params Balanced object literal
 * @returns {Set<string>}
 */
export function getTopLevelPropertyNames({ objectText }) {
  const names = new Set();
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;
  let escaped = false;

  for (let i = 0; i < objectText.length; i += 1) {
    const ch = objectText[i];
    const next = objectText[i + 1];

    if (inLineComment) {
      if (ch === '\n') {
        inLineComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }

    if (escaped) {
      escaped = false;
      continue;
    }

    if ((inSingle || inDouble || inTemplate) && ch === '\\') {
      escaped = true;
      continue;
    }

    if (inSingle) {
      if (ch === "'") {
        inSingle = false;
      }
      continue;
    }

    if (inDouble) {
      if (ch === '"') {
        inDouble = false;
      }
      continue;
    }

    if (inTemplate) {
      if (ch === '`') {
        inTemplate = false;
      }
      continue;
    }

    if (ch === '/' && next === '/') {
      inLineComment = true;
      i += 1;
      continue;
    }

    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i += 1;
      continue;
    }

    if (ch === "'") {
      inSingle = true;
      continue;
    }

    if (ch === '"') {
      inDouble = true;
      continue;
    }

    if (ch === '`') {
      inTemplate = true;
      continue;
    }

    if (ch === '{') {
      depth += 1;
      continue;
    }

    if (ch === '}') {
      depth -= 1;
      continue;
    }

    if (depth !== 1) {
      continue;
    }

    const rest = objectText.slice(i);
    const propertyMatch = rest.match(/^([A-Za-z_$][\w$]*)\s*:/);
    if (propertyMatch) {
      names.add(propertyMatch[1]);
      i += propertyMatch[0].length - 1;
    }
  }

  return names;
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

      if (!entry.isFile() || !entry.name.endsWith('.ts')) {
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

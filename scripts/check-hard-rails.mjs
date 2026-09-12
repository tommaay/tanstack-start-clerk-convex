/**
 * Fail on repo rules that Biome and ESLint do not cover.
 *
 * Rails (scanned in `src/` and `convex/`):
 * 1. No history comments: a `do not` / `never` clause followed on the same
 *    line by a `because` clause. Put the rule in `INSTRUCTIONS.md` or lint.
 * 2. Server-only modules (`~/utils/logger`, `~/utils/env`) must not be imported
 *    from `src/components/**` or `src/lib/**`. Those folders ship to the
 *    browser; Winston and `process.env` do not work there.
 *
 * Add a rail here when agents repeat the same mistake, not ahead of time.
 */
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_DIRS = ['src', 'convex'];
const SKIP_DIRS = new Set(['node_modules', 'dist', '_generated', '.git']);
const SKIP_FILES = new Set(['src/routeTree.gen.ts']);
const SOURCE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);
const HISTORY_COMMENT_RE =
  /(?:\/\/|\/\*|\*(?!\/)|\*\/)\s*(?:.*\b(?:do not|don't|never|Do not|Never)\b.*\bbecause\b)/i;
/**
 * Static `from "…"`, side-effect `import "…"`, dynamic `import("…")`, and
 * `require("…")` of a server-only module.
 */
const SERVER_ONLY_IMPORT_RE =
  /(?:\bfrom\s+|\bimport\s+|\bimport\s*\(\s*|\brequire\s*\(\s*)["'](?:~\/utils\/(?:logger|env)|(?:\.\.?\/)+utils\/(?:logger|env))(?:\.ts)?["']/;
const CLIENT_ONLY_PREFIXES = ['src/components/', 'src/lib/'];

/**
 * @typedef {{ file: string; line: number; message: string }} RailFinding
 */

/**
 * True when `relativePath` is a folder that only ships to the browser.
 *
 * @param {{ relativePath: string }} params POSIX-ish path from the repo root
 * @returns {{ isClientOnly: boolean }}
 */
export function isClientOnlyPath({ relativePath }) {
  const normalized = relativePath.replaceAll('\\', '/');
  return {
    isClientOnly: CLIENT_ONLY_PREFIXES.some((prefix) =>
      normalized.startsWith(prefix),
    ),
  };
}

/**
 * Return the 1-based line of the first match, or 1 when the pattern is not found.
 *
 * @param {{ contents: string; pattern: RegExp }} params File text and pattern
 * @returns {{ line: number }}
 */
function lineOf({ contents, pattern }) {
  const index = contents.search(pattern);
  if (index < 0) {
    return { line: 1 };
  }
  return { line: contents.slice(0, index).split('\n').length };
}

/**
 * Collect hard-rail violations in one source file.
 *
 * @param {{ relativePath: string; contents: string }} params Path and file text
 * @returns {{ findings: RailFinding[] }}
 */
export function scanSourceFile({ relativePath, contents }) {
  /** @type {RailFinding[]} */
  const findings = [];
  const normalized = relativePath.replaceAll('\\', '/');

  const lines = contents.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    if (!HISTORY_COMMENT_RE.test(lines[index])) {
      continue;
    }
    findings.push({
      file: normalized,
      line: index + 1,
      message:
        'Do not store history in source comments (do not/never … because). Put the rule in INSTRUCTIONS.md or lint.',
    });
  }

  const { isClientOnly } = isClientOnlyPath({ relativePath: normalized });
  if (isClientOnly && SERVER_ONLY_IMPORT_RE.test(contents)) {
    findings.push({
      file: normalized,
      line: lineOf({ contents, pattern: SERVER_ONLY_IMPORT_RE }).line,
      message:
        'Server-only module imported from client code. ~/utils/logger and ~/utils/env are Node-only; call them from a server function instead.',
    });
  }

  return { findings };
}

/**
 * True when this file name has a TypeScript or JavaScript extension.
 *
 * @param {{ name: string }} params File name
 * @returns {{ isSource: boolean }}
 */
function isSourceFile({ name }) {
  const dot = name.lastIndexOf('.');
  if (dot < 0) {
    return { isSource: false };
  }
  return { isSource: SOURCE_EXT.has(name.slice(dot)) };
}

/**
 * Walk `dir` and collect findings relative to `root`.
 *
 * @param {{ root: string; dir: string }} params Repo root and current directory
 * @returns {Promise<{ findings: RailFinding[] }>}
 */
async function walk({ root, dir }) {
  const entries = await readdir(dir, { withFileTypes: true });
  /** @type {RailFinding[]} */
  const findings = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) {
        continue;
      }
      const nested = await walk({ root, dir: join(dir, entry.name) });
      findings.push(...nested.findings);
      continue;
    }

    if (!entry.isFile() || !isSourceFile({ name: entry.name }).isSource) {
      continue;
    }

    const filePath = join(dir, entry.name);
    const relativePath = relative(root, filePath).replaceAll('\\', '/');
    if (SKIP_FILES.has(relativePath)) {
      continue;
    }

    const contents = await readFile(filePath, 'utf8');
    const { findings: fileFindings } = scanSourceFile({
      relativePath,
      contents,
    });
    findings.push(...fileFindings);
  }

  return { findings };
}

/**
 * Scan `src/` and `convex/` for hard-rail violations.
 *
 * @param {{ root: string }} params Repo root
 * @returns {Promise<{ findings: RailFinding[] }>}
 */
export async function scanHardRails({ root }) {
  /** @type {RailFinding[]} */
  const findings = [];
  for (const folder of SCAN_DIRS) {
    const dir = join(root, folder);
    try {
      const result = await walk({ root, dir });
      findings.push(...result.findings);
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        continue;
      }
      throw error;
    }
  }
  return { findings };
}

const isMain =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  const { findings } = await scanHardRails({ root: ROOT });
  for (const finding of findings) {
    process.stderr.write(
      `${finding.file}:${finding.line}: ${finding.message}\n`,
    );
  }
  if (findings.length > 0) {
    process.exitCode = 1;
  }
}

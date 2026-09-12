/**
 * Walks the repo for INSTRUCTIONS.md (source of truth) and writes sibling
 * AGENTS.md + CLAUDE.md. Do not edit those generated files by hand.
 *
 * Each AGENTS.md is that directory's INSTRUCTIONS.md plus a generated header.
 * Closest AGENTS.md wins — nested files are not concatenated with root.
 * Always skips `convex/`, `node_modules`, `dist`, `.git`, and `_generated`.
 *
 * Convex AI files own a marked section in AGENTS.md and CLAUDE.md. Sync keeps
 * that section. Source: https://docs.convex.dev/cli/reference/ai-files
 */
import { readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set([
  'convex',
  'node_modules',
  'dist',
  '.git',
  '_generated',
]);
const INSTRUCTIONS_NAME = 'INSTRUCTIONS.md';
const AGENTS_NAME = 'AGENTS.md';
const CLAUDE_NAME = 'CLAUDE.md';
const GENERATED_HEADER =
  'Generated from INSTRUCTIONS.md. Do not edit. Run pnpm agents:sync';
const CLAUDE_BODY = `@AGENTS.md

\`AGENTS.md\` is generated. Do not edit it.
`;
const CONVEX_AI_START = '<!-- convex-ai-start -->';
const CONVEX_AI_END = '<!-- convex-ai-end -->';

/**
 * Return the Convex-managed AI section, or an empty string when it is absent.
 *
 * Only a marker that starts a line counts. Inline mentions in `INSTRUCTIONS.md`
 * must not match.
 *
 * Source: https://docs.convex.dev/cli/reference/ai-files — Convex writes a
 * section in AGENTS.md / CLAUDE.md between these HTML comments.
 *
 * @param {string} contents File text
 * @returns {string} Marker block, including start and end comments
 */
export function extractConvexAiBlock(contents) {
  const startMatch = contents.match(new RegExp(`^${CONVEX_AI_START}`, 'm'));
  const endMatch = contents.match(new RegExp(`^${CONVEX_AI_END}`, 'm'));

  if (!startMatch && !endMatch) {
    return '';
  }

  if (
    !startMatch ||
    !endMatch ||
    startMatch.index === undefined ||
    endMatch.index === undefined ||
    endMatch.index < startMatch.index
  ) {
    throw new Error(
      'Broken Convex AI marker pair (<!-- convex-ai-start --> / <!-- convex-ai-end -->).',
    );
  }

  return contents
    .slice(startMatch.index, endMatch.index + CONVEX_AI_END.length)
    .trimEnd();
}

/**
 * Remove a Convex AI marker block from generated or source markdown.
 *
 * @param {string} contents File text
 * @returns {string} Text without the marker block
 */
export function stripConvexAiBlock(contents) {
  const block = extractConvexAiBlock(contents);
  if (!block) {
    return contents;
  }

  const start = contents.indexOf(block);
  if (start === -1) {
    return contents;
  }

  const before = contents.slice(0, start).trimEnd();
  const after = contents.slice(start + block.length).trimStart();

  if (!after) {
    return before;
  }

  return `${before}\n\n${after}`;
}

/**
 * Append a Convex AI marker block after generated markdown.
 *
 * @param {{ body: string; block: string }} params Generated body and optional block
 * @returns {{ markdown: string }} File text with a trailing newline
 */
export function withConvexAiBlock({ body, block }) {
  const trimmed = body.trimEnd();
  if (!block) {
    return { markdown: `${trimmed}\n` };
  }

  return { markdown: `${trimmed}\n\n${block.trimEnd()}\n` };
}

/**
 * Read the Convex AI marker block from a file. Missing files return empty.
 *
 * @param {string} filePath Absolute path
 * @returns {Promise<string>} Marker block or empty string
 */
async function readConvexAiBlock(filePath) {
  try {
    const contents = await readFile(filePath, 'utf8');
    return extractConvexAiBlock(contents);
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return '';
    }
    throw error;
  }
}

/**
 * Recursively walk `root`, generate siblings next to INSTRUCTIONS.md, and
 * remove stale generated AGENTS.md / CLAUDE.md when INSTRUCTIONS.md is gone.
 *
 * @param {{ root: string }} params Directory to walk
 * @returns {Promise<void>}
 */
export async function syncAgentDocs({ root }) {
  await syncDirectory(root);
}

/**
 * Recursively walk `dir`, generate siblings next to INSTRUCTIONS.md, and
 * remove stale generated AGENTS.md / CLAUDE.md when INSTRUCTIONS.md is gone.
 *
 * @param {string} dir Directory to walk
 * @returns {Promise<void>}
 */
async function syncDirectory(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const names = new Set(entries.map((entry) => entry.name));
  const hasInstructions = names.has(INSTRUCTIONS_NAME);

  if (hasInstructions) {
    const agentsPath = join(dir, AGENTS_NAME);
    const claudePath = join(dir, CLAUDE_NAME);
    const agentsBlock = await readConvexAiBlock(agentsPath);
    const claudeBlock = await readConvexAiBlock(claudePath);
    const instructions = stripConvexAiBlock(
      await readFile(join(dir, INSTRUCTIONS_NAME), 'utf8'),
    );
    const agentsBody = `# ${GENERATED_HEADER}\n\n${instructions.trimEnd()}`;
    const { markdown: agentsMarkdown } = withConvexAiBlock({
      body: agentsBody,
      block: agentsBlock,
    });
    const { markdown: claudeMarkdown } = withConvexAiBlock({
      body: CLAUDE_BODY,
      block: claudeBlock,
    });
    await writeFile(agentsPath, agentsMarkdown, 'utf8');
    await writeFile(claudePath, claudeMarkdown, 'utf8');
  } else {
    await removeStaleGeneratedSibling({ dir, names, fileName: AGENTS_NAME });
    await removeStaleGeneratedSibling({ dir, names, fileName: CLAUDE_NAME });
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || SKIP_DIRS.has(entry.name)) {
      continue;
    }
    await syncDirectory(join(dir, entry.name));
  }
}

/**
 * Delete a generated sibling when INSTRUCTIONS.md is missing.
 *
 * @param {{ dir: string; names: Set<string>; fileName: string }} params Path and file name
 * @returns {Promise<void>}
 */
async function removeStaleGeneratedSibling({ dir, names, fileName }) {
  if (!names.has(fileName)) {
    return;
  }

  const filePath = join(dir, fileName);
  const contents = await readFile(filePath, 'utf8');
  if (
    !contents.startsWith(`# ${GENERATED_HEADER}`) &&
    fileName === AGENTS_NAME
  ) {
    return;
  }
  // A hand-written CLAUDE.md may also start with `@AGENTS.md`; only the full
  // generated preamble marks a file this script owns.
  if (fileName === CLAUDE_NAME && !contents.startsWith(CLAUDE_BODY)) {
    return;
  }

  await unlink(filePath);
}

const isMain =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  await syncAgentDocs({ root: ROOT });
}

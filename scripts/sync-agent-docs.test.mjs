/**
 * Tests for agent-doc sync. Convex AI marker blocks must survive regeneration.
 *
 * Source: https://docs.convex.dev/cli/reference/ai-files
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  extractConvexAiBlock,
  stripConvexAiBlock,
  syncAgentDocs,
  withConvexAiBlock,
} from './sync-agent-docs.mjs';

const CONVEX_AI_BLOCK = `<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

<!-- convex-ai-end -->`;

/** @type {string[]} */
const tempDirs = [];

/**
 * Create a unique temp directory and record it for cleanup.
 *
 * @returns {Promise<string>} Absolute path
 */
async function makeTempRoot() {
  const root = await mkdtemp(join(tmpdir(), 'agents-sync-'));
  tempDirs.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe('extractConvexAiBlock', () => {
  it('returns empty when markers are absent', () => {
    expect(extractConvexAiBlock('# Brief\n')).toBe('');
  });

  it('returns the marker pair when present', () => {
    expect(extractConvexAiBlock(`# Brief\n\n${CONVEX_AI_BLOCK}\n`)).toBe(
      CONVEX_AI_BLOCK,
    );
  });

  it('ignores inline mentions of the markers', () => {
    expect(
      extractConvexAiBlock(
        'Keeps `<!-- convex-ai-start -->` … `<!-- convex-ai-end -->`.\n',
      ),
    ).toBe('');
  });

  it('throws when the marker pair is broken', () => {
    expect(() =>
      extractConvexAiBlock('<!-- convex-ai-start -->\nno end\n'),
    ).toThrow(/Broken Convex AI marker pair/);
  });
});

describe('stripConvexAiBlock', () => {
  it('removes the marker block from INSTRUCTIONS.md copy', () => {
    const stripped = stripConvexAiBlock(
      `# Brief\n\nHello.\n\n${CONVEX_AI_BLOCK}\n`,
    );
    expect(stripped).toBe('# Brief\n\nHello.');
    expect(stripped).not.toContain('convex-ai-start');
  });
});

describe('withConvexAiBlock', () => {
  it('appends the block after generated markdown', () => {
    const { markdown } = withConvexAiBlock({
      body: '# Generated header\n\n# Brief',
      block: CONVEX_AI_BLOCK,
    });
    expect(markdown).toBe(
      `# Generated header\n\n# Brief\n\n${CONVEX_AI_BLOCK}\n`,
    );
  });

  it('omits a trailing blank section when the block is empty', () => {
    const { markdown } = withConvexAiBlock({ body: '# Brief\n', block: '' });
    expect(markdown).toBe('# Brief\n');
  });
});

describe('syncAgentDocs', () => {
  it('keeps Convex AI blocks when it regenerates AGENTS.md and CLAUDE.md', async () => {
    const root = await makeTempRoot();
    await writeFile(
      join(root, 'INSTRUCTIONS.md'),
      '# Polaristarter\n\nNew body.\n',
      'utf8',
    );
    await writeFile(
      join(root, 'AGENTS.md'),
      `# Generated from INSTRUCTIONS.md. Do not edit. Run pnpm agents:sync\n\n# Polaristarter\n\nOld body.\n\n${CONVEX_AI_BLOCK}\n`,
      'utf8',
    );
    await writeFile(
      join(root, 'CLAUDE.md'),
      `@AGENTS.md\n\n\`AGENTS.md\` is generated. Do not edit it.\n\n${CONVEX_AI_BLOCK}\n`,
      'utf8',
    );

    await syncAgentDocs({ root });

    const agents = await readFile(join(root, 'AGENTS.md'), 'utf8');
    const claude = await readFile(join(root, 'CLAUDE.md'), 'utf8');

    expect(agents).toContain('New body.');
    expect(agents).not.toContain('Old body.');
    expect(agents).toContain(CONVEX_AI_BLOCK);
    expect(claude.startsWith('@AGENTS.md')).toBe(true);
    expect(claude).toContain(CONVEX_AI_BLOCK);
  });

  it('does not copy a Convex AI block from INSTRUCTIONS.md', async () => {
    const root = await makeTempRoot();
    await writeFile(
      join(root, 'INSTRUCTIONS.md'),
      `# Polaristarter\n\nHello.\n\n${CONVEX_AI_BLOCK}\n`,
      'utf8',
    );

    await syncAgentDocs({ root });

    const agents = await readFile(join(root, 'AGENTS.md'), 'utf8');
    expect(agents).toContain('Hello.');
    expect(agents).not.toContain('convex-ai-start');
  });

  it('keeps inline marker mentions from INSTRUCTIONS.md and the real block from AGENTS.md', async () => {
    const root = await makeTempRoot();
    await writeFile(
      join(root, 'INSTRUCTIONS.md'),
      'Sync keeps `<!-- convex-ai-start -->` and `<!-- convex-ai-end -->`.\n',
      'utf8',
    );
    await writeFile(
      join(root, 'AGENTS.md'),
      `# Generated from INSTRUCTIONS.md. Do not edit. Run pnpm agents:sync\n\nOld.\n\n${CONVEX_AI_BLOCK}\n`,
      'utf8',
    );

    await syncAgentDocs({ root });

    const agents = await readFile(join(root, 'AGENTS.md'), 'utf8');
    expect(agents).toContain('`<!-- convex-ai-start -->`');
    expect(agents).toContain('`<!-- convex-ai-end -->`');
    expect(agents).toContain(CONVEX_AI_BLOCK);
    expect(agents).not.toContain('Old.');
  });

  it('does not copy a parent Convex AI block into a nested AGENTS.md', async () => {
    const root = await makeTempRoot();
    await writeFile(join(root, 'INSTRUCTIONS.md'), '# Root\n', 'utf8');
    await writeFile(
      join(root, 'AGENTS.md'),
      `# Generated from INSTRUCTIONS.md. Do not edit. Run pnpm agents:sync\n\n# Root\n\n${CONVEX_AI_BLOCK}\n`,
      'utf8',
    );
    const nested = join(root, 'feature');
    await mkdir(nested);
    await writeFile(join(nested, 'INSTRUCTIONS.md'), '# Feature\n', 'utf8');

    await syncAgentDocs({ root });

    const nestedAgents = await readFile(join(nested, 'AGENTS.md'), 'utf8');
    expect(nestedAgents).toContain('# Feature');
    expect(nestedAgents).not.toContain('convex-ai-start');
  });
});

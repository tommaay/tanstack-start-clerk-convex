/**
 * Tests for Convex validator scans (args + returns on registered functions).
 */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  scanConvexDirectory,
  scanConvexValidators,
} from './check-convex-returns.mjs';

/** @type {string[]} */
const tempDirs = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

/**
 * Scan a snippet and report which validators it flags.
 *
 * @param {string} contents Convex module source
 * @returns {{ args: boolean; returns: boolean; lines: number[] }}
 */
function flagsFor(contents) {
  const { findings } = scanConvexValidators({
    relativePath: 'convex/example.ts',
    contents,
  });
  return {
    args: findings.some((finding) => finding.message.includes('args')),
    returns: findings.some((finding) => finding.message.includes('returns')),
    lines: findings.map((finding) => finding.line),
  };
}

describe('scanConvexValidators', () => {
  it('passes when args and returns are present', () => {
    const { findings } = scanConvexValidators({
      relativePath: 'convex/example.ts',
      contents: `export const list = query({
  args: {},
  returns: v.array(v.string()),
  handler: async () => [],
});
`,
    });
    expect(findings).toEqual([]);
  });

  it('flags missing returns with the registrar line', () => {
    const result = flagsFor(`import { v } from 'convex/values';

export const list = query({
  args: {},
  handler: async () => [],
});
`);
    expect(result).toEqual({ args: false, returns: true, lines: [3] });
  });

  it('flags missing args', () => {
    expect(
      flagsFor(`export const list = internalMutation({
  returns: v.null(),
  handler: async () => null,
});
`).args,
    ).toBe(true);
  });

  it('flags missing validators when a comment contains an unmatched brace', () => {
    const result = flagsFor(`export const list = query({
  // {
  handler: async () => null,
});
`);
    expect(result.args).toBe(true);
    expect(result.returns).toBe(true);
  });

  it('flags missing validators when a block comment precedes the object', () => {
    const result = flagsFor(`export const list = query(/* { */ {
  handler: async () => null,
});
`);
    expect(result.args).toBe(true);
    expect(result.returns).toBe(true);
  });

  it('flags missing validators when a registrar comment precedes the call', () => {
    const result = flagsFor(`export const list = mutation /* note */ ({
  handler: async () => null,
});
`);
    expect(result.args).toBe(true);
    expect(result.returns).toBe(true);
  });

  it('flags missing validators for function-form registrars', () => {
    const result = flagsFor(`export const list = mutation(async () => ({
  handler: async () => null,
}));
`);
    expect(result.args).toBe(true);
    expect(result.returns).toBe(true);
  });

  it('flags missing validators for direct callback function-form registrars', () => {
    const result = flagsFor(`export const list = mutation(async (ctx, args) => {
  return null;
});
`);
    expect(result.args).toBe(true);
    expect(result.returns).toBe(true);
  });

  it('ignores args and returns tokens in comments and strings', () => {
    const result = flagsFor(`export const list = query({
  // args: required
  handler: async () => {
    const note = "returns: v.null()";
    return null;
  },
});
`);
    expect(result.args).toBe(true);
    expect(result.returns).toBe(true);
  });

  it('flags missing returns when the handler contains a regex literal with braces', () => {
    const result = flagsFor(`export const isCode = query({
  args: { value: v.string() },
  handler: async (_ctx, args) => /^\\d{3}-\\d{2}$/.test(args.value),
});
`);
    expect(result).toEqual({ args: false, returns: true, lines: [1] });
  });

  it('passes when a regex literal with braces sits next to both validators', () => {
    const { findings } = scanConvexValidators({
      relativePath: 'convex/example.ts',
      contents: `export const isCode = query({
  args: { value: v.string() },
  returns: v.boolean(),
  handler: async (_ctx, args) => /[{']/.test(args.value) && /\\d{3}/.test(args.value),
});
`,
    });
    expect(findings).toEqual([]);
  });

  it('flags missing returns when a template literal contains braces and backticks', () => {
    /** Source text of a template placeholder, built so the test itself has none. */
    const placeholder = (expr) => ['$', '{', expr, '}'].join('');
    const result = flagsFor(`export const greet = mutation({
  args: { name: v.string() },
  handler: async (_ctx, args) => \`Hi ${placeholder('args.name')} {${placeholder('`nested`')}}\`,
});
`);
    expect(result).toEqual({ args: false, returns: true, lines: [1] });
  });

  it('does not treat a nested handler property as a top-level validator', () => {
    const result = flagsFor(`export const list = query({
  handler: async () => ({ args: {}, returns: null }),
});
`);
    expect(result.args).toBe(true);
    expect(result.returns).toBe(true);
  });

  it('flags validators hidden behind a spread as missing', () => {
    const result = flagsFor(`export const list = query({
  ...shared,
  handler: async () => null,
});
`);
    expect(result.args).toBe(true);
    expect(result.returns).toBe(true);
  });

  it('flags a default-exported registrar call', () => {
    const result = flagsFor(`import { query } from './_generated/server';

export default query({ handler: async () => null });
`);
    expect(result).toEqual({ args: true, returns: true, lines: [3, 3] });
  });

  it('passes a default-exported registrar call with both validators', () => {
    const result = flagsFor(`export default query({
  args: {},
  returns: v.null(),
  handler: async () => null,
});
`);
    expect(result).toEqual({ args: false, returns: false, lines: [] });
  });

  it.each([
    ['export default name', 'export default list;\n'],
    ['export { name }', 'export { list };\n'],
    ['export { name as other }', 'export { list as fetchAll };\n'],
    ['export { name as default }', 'export { list as default };\n'],
  ])('flags a local registrar exported through %s', (_label, exportLine) => {
    const result = flagsFor(
      `const list = query({ handler: async () => null });\n\n${exportLine}`,
    );
    expect(result).toEqual({ args: true, returns: true, lines: [1, 1] });
  });

  it('reports a registrar once when it is exported twice', () => {
    const result =
      flagsFor(`export const list = query({ handler: async () => null });

export default list;
`);
    expect(result.lines).toEqual([1, 1]);
  });

  it('ignores re-exports from other modules and locals that stay private', () => {
    const result =
      flagsFor(`const hidden = query({ handler: async () => null });

export { list } from './posts';
export const other = 1;
`);
    expect(result).toEqual({ args: false, returns: false, lines: [] });
  });

  it('ignores non-exported and non-registrar calls', () => {
    const { findings } = scanConvexValidators({
      relativePath: 'convex/example.ts',
      contents: `const helper = query({ handler: async () => null });
export const wrapped = authedQuery({ handler: async () => null });
export const value = compute({ handler: 1 });
`,
    });
    expect(findings).toEqual([]);
  });

  it.each([
    [
      'convex/legacy.js',
      'export const list = query({ handler: async () => null });\n',
    ],
    [
      'convex/legacy.mjs',
      'export const list = mutation({ handler: async () => null });\n',
    ],
    [
      'convex/widget.tsx',
      'export const list = action({ handler: async () => <div /> });\n',
    ],
  ])('scans %s like the Convex bundler does', (relativePath, contents) => {
    const { findings } = scanConvexValidators({ relativePath, contents });
    expect(findings.map((finding) => finding.message)).toEqual([
      'Convex function is missing an `args` validator.',
      'Convex function is missing a `returns` validator.',
    ]);
  });

  it('skips generated files', () => {
    const { findings } = scanConvexValidators({
      relativePath: 'convex/_generated/api.ts',
      contents: 'export const list = query({ handler: async () => null });\n',
    });
    expect(findings).toEqual([]);
  });
});

describe('scanConvexDirectory', () => {
  it('walks every Convex module extension and skips _generated', async () => {
    const root = await mkdtemp(join(tmpdir(), 'convex-returns-'));
    tempDirs.push(root);
    const convexDir = join(root, 'convex');
    await mkdir(join(convexDir, '_generated'), { recursive: true });
    await mkdir(join(convexDir, 'nested'));
    const missing =
      'export const list = query({ handler: async () => null });\n';
    await writeFile(join(convexDir, 'a.ts'), missing, 'utf8');
    await writeFile(join(convexDir, 'b.js'), missing, 'utf8');
    await writeFile(join(convexDir, 'nested', 'c.mjs'), missing, 'utf8');
    await writeFile(join(convexDir, '_generated', 'd.js'), missing, 'utf8');
    await writeFile(join(convexDir, 'notes.md'), missing, 'utf8');

    const { findings } = await scanConvexDirectory({ root });

    expect(
      [...new Set(findings.map((finding) => finding.file))].sort(),
    ).toEqual(['convex/a.ts', 'convex/b.js', 'convex/nested/c.mjs']);
  });
});

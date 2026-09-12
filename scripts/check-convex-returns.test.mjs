/**
 * Tests for Convex validator scans (args + returns on registered functions).
 */
import { describe, expect, it } from 'vitest';
import {
  findNextObjectBraceIndex,
  getTopLevelPropertyNames,
  scanConvexValidators,
} from './check-convex-returns.mjs';

describe('getTopLevelPropertyNames', () => {
  it('reads top-level keys and ignores nested handler properties', () => {
    const names = getTopLevelPropertyNames({
      objectText: `{
  args: {},
  returns: v.null(),
  handler: async () => {
    const note = "returns: fake";
    // args: fake
    return null;
  },
}`,
    });

    expect(names.has('args')).toBe(true);
    expect(names.has('returns')).toBe(true);
    expect(names.has('handler')).toBe(true);
    expect(names.has('fake')).toBe(false);
  });
});

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

  it('flags missing returns', () => {
    const { findings } = scanConvexValidators({
      relativePath: 'convex/example.ts',
      contents: `export const list = query({
  args: {},
  handler: async () => [],
});
`,
    });
    expect(
      findings.some((finding) => finding.message.includes('returns')),
    ).toBe(true);
  });

  it('flags missing args', () => {
    const { findings } = scanConvexValidators({
      relativePath: 'convex/example.ts',
      contents: `export const list = internalMutation({
  returns: v.null(),
  handler: async () => null,
});
`,
    });
    expect(findings.some((finding) => finding.message.includes('args'))).toBe(
      true,
    );
  });

  it('flags missing validators when a comment contains an unmatched brace', () => {
    const { findings } = scanConvexValidators({
      relativePath: 'convex/example.ts',
      contents: `export const list = query({
  // {
  handler: async () => null,
});
`,
    });
    expect(findings.some((finding) => finding.message.includes('args'))).toBe(
      true,
    );
    expect(
      findings.some((finding) => finding.message.includes('returns')),
    ).toBe(true);
  });

  it('flags missing validators when a block comment precedes the object', () => {
    const { findings } = scanConvexValidators({
      relativePath: 'convex/example.ts',
      contents: `export const list = query(/* { */ {
  handler: async () => null,
});
`,
    });
    expect(findings.some((finding) => finding.message.includes('args'))).toBe(
      true,
    );
    expect(
      findings.some((finding) => finding.message.includes('returns')),
    ).toBe(true);
  });

  it('flags missing validators when a registrar comment precedes the call', () => {
    const { findings } = scanConvexValidators({
      relativePath: 'convex/example.ts',
      contents: `export const list = mutation /* note */ ({
  handler: async () => null,
});
`,
    });
    expect(findings.some((finding) => finding.message.includes('args'))).toBe(
      true,
    );
    expect(
      findings.some((finding) => finding.message.includes('returns')),
    ).toBe(true);
  });

  it('flags missing validators for function-form registrars', () => {
    const { findings } = scanConvexValidators({
      relativePath: 'convex/example.ts',
      contents: `export const list = mutation(async () => ({
  handler: async () => null,
}));
`,
    });
    expect(findings.some((finding) => finding.message.includes('args'))).toBe(
      true,
    );
    expect(
      findings.some((finding) => finding.message.includes('returns')),
    ).toBe(true);
  });

  it('flags missing validators for direct callback function-form registrars', () => {
    const { findings } = scanConvexValidators({
      relativePath: 'convex/example.ts',
      contents: `export const list = mutation(async (ctx, args) => {
  return null;
});
`,
    });
    expect(findings.some((finding) => finding.message.includes('args'))).toBe(
      true,
    );
    expect(
      findings.some((finding) => finding.message.includes('returns')),
    ).toBe(true);
  });

  it('ignores args and returns tokens in comments and strings', () => {
    const { findings } = scanConvexValidators({
      relativePath: 'convex/example.ts',
      contents: `export const list = query({
  // args: required
  handler: async () => {
    const note = "returns: v.null()";
    return null;
  },
});
`,
    });
    expect(findings.some((finding) => finding.message.includes('args'))).toBe(
      true,
    );
    expect(
      findings.some((finding) => finding.message.includes('returns')),
    ).toBe(true);
  });
});

describe('findNextObjectBraceIndex', () => {
  it('skips braces inside block comments', () => {
    const index = findNextObjectBraceIndex({
      contents: 'query(/* { */ { handler: true })',
      startIndex: 0,
    });
    expect(index).toBe('query(/* { */ { handler: true })'.indexOf('{ handler'));
  });
});

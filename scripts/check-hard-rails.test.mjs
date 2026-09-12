/**
 * Tests for the hard-rail scan (history comments, server-only imports).
 */
import { describe, expect, it } from 'vitest';
import { isClientOnlyPath, scanSourceFile } from './check-hard-rails.mjs';

describe('isClientOnlyPath', () => {
  it('treats src/components and src/lib as client-only', () => {
    expect(
      isClientOnlyPath({ relativePath: 'src/components/ui/button.tsx' })
        .isClientOnly,
    ).toBe(true);
    expect(
      isClientOnlyPath({ relativePath: 'src/lib/utils.ts' }).isClientOnly,
    ).toBe(true);
  });

  it('does not treat routes or utils as client-only', () => {
    expect(
      isClientOnlyPath({ relativePath: 'src/routes/__root.tsx' }).isClientOnly,
    ).toBe(false);
    expect(
      isClientOnlyPath({ relativePath: 'src/utils/logger.ts' }).isClientOnly,
    ).toBe(false);
  });
});

describe('scanSourceFile', () => {
  it('flags history comments with do not/never and because', () => {
    const { findings } = scanSourceFile({
      relativePath: 'src/routes/index.tsx',
      contents: '// Do not use fetch here because Convex owns the data\n',
    });
    expect(
      findings.some((finding) => finding.message.includes('history')),
    ).toBe(true);
  });

  it('allows comments with do not but no because', () => {
    const { findings } = scanSourceFile({
      relativePath: 'src/routes/index.tsx',
      contents: '/** Do not return the whole identity. */\n',
    });
    expect(findings).toEqual([]);
  });

  it('flags the logger imported from a component', () => {
    const { findings } = scanSourceFile({
      relativePath: 'src/components/user-menu.tsx',
      contents: "import { logger } from '~/utils/logger';\n",
    });
    const finding = findings.find((item) =>
      item.message.includes('Server-only'),
    );
    expect(finding).toMatchObject({ line: 1 });
  });

  it.each([
    ['relative import', "import { requireEnv } from '../utils/env';\n"],
    ['dynamic import', "const { logger } = await import('~/utils/logger');\n"],
    ['require', "const { logger } = require('~/utils/logger');\n"],
  ])('flags a %s of a server-only module from src/lib', (_label, contents) => {
    const { findings } = scanSourceFile({
      relativePath: 'src/lib/helpers.ts',
      contents,
    });
    expect(findings.some((item) => item.message.includes('Server-only'))).toBe(
      true,
    );
  });

  it('allows the logger in routes and server utilities', () => {
    for (const relativePath of [
      'src/routes/__root.tsx',
      'src/utils/other.ts',
      'src/start.ts',
    ]) {
      const { findings } = scanSourceFile({
        relativePath,
        contents: "import { logger } from '~/utils/logger';\n",
      });
      expect(findings, relativePath).toEqual([]);
    }
  });

  it('does not flag unrelated imports in components', () => {
    const { findings } = scanSourceFile({
      relativePath: 'src/components/ui/button.tsx',
      contents: "import { cn } from '~/lib/utils';\n",
    });
    expect(findings).toEqual([]);
  });
});

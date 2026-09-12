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

  it('reports the exact line inside a multi-line comment', () => {
    const { findings } = scanSourceFile({
      relativePath: 'src/routes/index.tsx',
      contents: `const a = 1;
/**
 * Loads posts.
 * Never call twice because it double-charges.
 */
const b = 2; // do not inline because tests spy on it
`,
    });
    expect(findings.map((finding) => finding.line)).toEqual([4, 6]);
  });

  it.each([
    ['plain string', 'const s = "Never do this because it breaks";\n'],
    [
      'string with a URL before the phrase',
      'const s = "See https://x.io - never do this because it breaks";\n',
    ],
    ['regex literal', 'const re = /\\/\\/ never .* because/;\n'],
    [
      'template literal',
      `const t = \`/* do not retry because ${['$', '{', 'reason', '}'].join('')} */\`;\n`,
    ],
    [
      'multiplication before a string',
      'const n = a * b; const s = "do not retry because it loops";\n',
    ],
  ])('does not treat a %s as a history comment', (_label, contents) => {
    const { findings } = scanSourceFile({
      relativePath: 'src/routes/index.ts',
      contents,
    });
    expect(findings).toEqual([]);
  });

  it('does not treat JSX text as a history comment', () => {
    const { findings } = scanSourceFile({
      relativePath: 'src/routes/index.tsx',
      contents:
        'export const P = () => <p>// never do this because it breaks</p>;\n',
    });
    expect(findings).toEqual([]);
  });

  it('flags history comments in JavaScript files', () => {
    const { findings } = scanSourceFile({
      relativePath: 'convex/legacy.js',
      contents:
        'export const x = 1; // never change because prod depends on it\n',
    });
    expect(findings.map((finding) => finding.line)).toEqual([1]);
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
    ['side-effect import', "import '~/utils/logger';\n"],
    ['side-effect import with double quotes', 'import "../utils/env.ts";\n'],
    ['dynamic import', "const { logger } = await import('~/utils/logger');\n"],
    ['require', "const { logger } = require('~/utils/logger');\n"],
    ['.js extension import', "import { logger } from '../utils/logger.js';\n"],
    [
      '.jsx extension import',
      "import { requireEnv } from '~/utils/env.jsx';\n",
    ],
    ['.mjs extension import', "import '../../utils/logger.mjs';\n"],
    ['named re-export', "export { logger } from '~/utils/logger';\n"],
    ['star re-export', "export * from '../utils/env';\n"],
    ['import-equals require', "import env = require('~/utils/env');\n"],
  ])('flags a %s of a server-only module from src/lib', (_label, contents) => {
    const { findings } = scanSourceFile({
      relativePath: 'src/lib/helpers.ts',
      contents,
    });
    expect(findings.some((item) => item.message.includes('Server-only'))).toBe(
      true,
    );
  });

  it('reports the line of each server-only import', () => {
    const { findings } = scanSourceFile({
      relativePath: 'src/components/widget.tsx',
      contents: `// Server helpers live in ~/utils.
import { logger } from '~/utils/logger';
import { cn } from '~/lib/utils';
const { requireEnv } = await import('../utils/env');
`,
    });
    expect(findings.map((item) => item.line)).toEqual([2, 4]);
  });

  it.each([
    [
      'line comment that names the import',
      "// Rule: never import '~/utils/logger' in components; use console.error here.\nexport function Widget() { return null; }\n",
    ],
    [
      'block comment that names the import',
      "/* import { logger } from '~/utils/logger' is server-only */\nexport const a = 1;\n",
    ],
    [
      'string that names the import',
      'const hint = "import { logger } from \'~/utils/logger\'";\n',
    ],
    [
      'require with a non-literal argument',
      "const name = '~/utils/logger'; const mod = require(name);\n",
    ],
  ])('does not treat a %s as a server-only import', (_label, contents) => {
    const { findings } = scanSourceFile({
      relativePath: 'src/components/widget.tsx',
      contents,
    });
    expect(findings).toEqual([]);
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

/**
 * ESLint: `@convex-dev/eslint-plugin` on `convex/`, `@shadcn/lint` on `src/`.
 * Biome formats the repo and lints general `src/` + `scripts/` rules.
 *
 * `@convex-dev/eslint-plugin` sets rules but no parser. Type-aware
 * `typescript-eslint` is required so `convex/**\/*.ts` parses TypeScript syntax
 * and `@convex-dev/explicit-table-ids` can read `Id<"table">` types.
 *
 * `@shadcn/lint` reads `components.json`, cva variants, and the Tailwind v4
 * theme. Its JSX parser does not need `projectService`.
 *
 * Sources: https://docs.convex.dev/eslint
 * https://github.com/shadcn-ui/lint/blob/main/README.md
 */

import convexPlugin from '@convex-dev/eslint-plugin';
import { plugin as shadcn } from '@shadcn/lint';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

const shadcnNoRestyle = [
  'error',
  {
    allow: ['layout'],
    contracts: [
      { pattern: '^CardTitle$', allow: ['layout', 'typography'] },
      { pattern: '^CardDescription$', allow: ['layout', 'typography'] },
      {
        pattern: '^(CardContent|CardHeader|CardFooter)$',
        allow: ['layout', 'spacing'],
      },
      { pattern: '^Avatar$', allow: ['layout', 'size-*'] },
      {
        pattern: '^DropdownMenuLabel$',
        allow: ['layout', 'spacing'],
      },
      {
        pattern: '^Button$',
        allow: ['layout'],
        message: {
          spacing: 'Use a Button size: {{sizes}}.',
          default: 'Use a Button variant: {{variants}}.',
        },
      },
    ],
  },
];

export default defineConfig([
  {
    ignores: ['convex/_generated/**', 'src/routeTree.gen.ts'],
  },
  {
    files: ['convex/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  ...convexPlugin.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { shadcn },
    settings: {
      shadcn: {
        note: 'Use component variants and sizes. className is for layout. See INSTRUCTIONS.md.',
      },
    },
    rules: {
      'shadcn/no-restyle': shadcnNoRestyle,
      'shadcn/no-raw-colors': 'error',
      'shadcn/no-arbitrary-values': ['error', { allow: ['layout'] }],
      'shadcn/no-inline-styles': 'error',
      'shadcn/require-static-classes': 'error',
    },
  },
  {
    files: ['src/components/ui/**'],
    rules: {
      'shadcn/no-restyle': 'off',
      'shadcn/no-arbitrary-values': 'off',
      'shadcn/require-static-classes': 'off',
    },
  },
]);

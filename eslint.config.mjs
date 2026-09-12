/**
 * ESLint for `convex/` only. Biome formats the repo and lints everything else.
 *
 * `@convex-dev/eslint-plugin` sets rules but no parser. Type-aware
 * `typescript-eslint` is required so `convex/**\/*.ts` parses TypeScript syntax
 * and `@convex-dev/explicit-table-ids` can read `Id<"table">` types.
 *
 * Source: https://docs.convex.dev/eslint
 */
import convexPlugin from '@convex-dev/eslint-plugin';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig([
  {
    ignores: ['convex/_generated/**'],
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
]);

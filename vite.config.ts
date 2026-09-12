/**
 * Vite config for the TanStack Start app.
 *
 * Nitro builds the production server to `.output/` (`pnpm start`) and
 * auto-selects the Vercel preset when the build runs on Vercel.
 * Source: https://tanstack.com/start/latest/docs/framework/react/guide/hosting
 */
import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { nitro } from 'nitro/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
  },
  // Vite 8 resolves tsconfig `paths` natively (replaces vite-tsconfig-paths).
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [tailwindcss(), tanstackStart(), viteReact(), nitro()],
  // Workaround for https://github.com/TanStack/router/issues/5738
  optimizeDeps: {
    include: ['@clerk/tanstack-react-start'],
  },
});

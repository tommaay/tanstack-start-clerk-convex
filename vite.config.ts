import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import viteReact from '@vitejs/plugin-react';

export default defineConfig({
  server: {
    port: 3000,
  },
  // Vite 8 resolves tsconfig `paths` natively (replaces vite-tsconfig-paths).
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [tailwindcss(), tanstackStart(), viteReact()],
  // Workaround for https://github.com/TanStack/router/issues/5738
  optimizeDeps: {
    include: ['@clerk/tanstack-react-start'],
  },
});

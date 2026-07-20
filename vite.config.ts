import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import UnoCSS from 'unocss/vite';
import { defineConfig, lazyPlugins } from 'vite-plus';
import { docMarkdownPlugin } from './vite/doc-markdown';
import { docNavIndexPlugin } from './vite/doc-nav-index';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  build: {
    outDir: 'build/client',
    emptyOutDir: true,
  },
  test: {
    include: ['app/tests/**/*.{test,spec}.ts'],
    environment: 'node',
  },
  plugins: lazyPlugins(() => [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      routesDirectory: './app/routes',
      generatedRouteTree: './app/routeTree.gen.ts',
      quoteStyle: 'single',
    }),
    react(),
    UnoCSS(),
    docNavIndexPlugin(),
    docMarkdownPlugin(),
  ]),
});

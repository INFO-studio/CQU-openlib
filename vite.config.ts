import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import UnoCSS from 'unocss/vite';
import svgr from 'vite-plugin-svgr';
import { defineConfig, lazyPlugins } from 'vite-plus';
import { docMarkdownPlugin } from './vite/docMarkdown';
import { docNavIndexPlugin } from './vite/docNavIndex';
import { docSearchPlugin } from './vite/docSearch';
import { docSeoPlugin } from './vite/docSeo';

export default defineConfig(({ mode }) => ({
  resolve: {
    tsconfigPaths: true,
  },
  build: {
    assetsDir: 'app-assets',
    outDir: 'build/client',
    emptyOutDir: true,
  },
  test: {
    include: ['app/tests/**/*.{test,spec}.{ts,tsx}'],
    environment: 'node',
  },
  plugins:
    mode === 'test'
      ? []
      : lazyPlugins(() => [
          tanstackRouter({
            target: 'react',
            autoCodeSplitting: true,
            routesDirectory: './app/routes',
            generatedRouteTree: './app/routeTree.gen.ts',
            quoteStyle: 'single',
          }),
          react(),
          svgr(),
          UnoCSS(),
          docNavIndexPlugin(),
          docMarkdownPlugin(),
          docSearchPlugin(),
          docSeoPlugin(),
        ]),
}));

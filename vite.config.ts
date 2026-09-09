import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/clinical-primitives/',

  server: {
    watch: {
      // Build output lives inside the project root, so the dev server watches it
      // by default — and a write there is treated as a source change, which
      // forces a full page reload rather than a hot update.
      //
      // That happens on every save when `dev:lib` is running alongside `dev`:
      // the library bundle rebuilds into dist/, the docs server notices, and the
      // page reloads from scratch instead of hot-swapping the one module that
      // actually changed. Reloading this app is not cheap — DocsApp imports all
      // twenty pages eagerly, so a reload pulls the whole graph back down.
      ignored: ['**/dist/**', '**/docs-dist/**']
    }
  },

  build: {
    outDir: 'docs-dist',
    sourcemap: true,
    emptyOutDir: true
  }
});
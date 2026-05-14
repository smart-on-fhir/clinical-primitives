import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/clinical-primitives/',
  build: {
    outDir: 'docs-dist',
    sourcemap: true,
    emptyOutDir: true
  }
});
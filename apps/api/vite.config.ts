import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    ssr: 'src/main.ts',
    target: 'node22',
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: { output: { format: 'esm', entryFileNames: 'main.js' } },
  },
});

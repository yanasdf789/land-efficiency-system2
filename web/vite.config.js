import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  plugins: [vue()],
  // maplibre-gl v6 通过相对路径加载 Web Worker，预构建会打断该路径
  optimizeDeps: { exclude: ['maplibre-gl'] },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3001' }
  },
  build: { outDir: 'dist', emptyOutDir: true }
});

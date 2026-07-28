import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: '.',
  build: {
    outDir: 'dist/dashboard/public',
    emptyOutDir: false
  },
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:3333'
    }
  }
});

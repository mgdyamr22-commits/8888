
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './', // لضمان تحميل الأصول بشكل صحيح من مجلد dist
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        format: 'es',
      },
    },
  },
  server: {
    port: 3000,
    strictPort: true,
  }
});

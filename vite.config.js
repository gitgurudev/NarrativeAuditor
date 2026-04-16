import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // Pre-bundle pdfjs-dist so Vite doesn't re-process it on every HMR
    include: ['pdfjs-dist'],
  },
});

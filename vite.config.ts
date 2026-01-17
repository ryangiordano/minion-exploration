import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
          react: ['react', 'react-dom'],
        }
      }
    }
  },
  server: {
    port: 3000
  }
});

import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Ensures relative assets paths on GitHub Pages
  build: {
    chunkSizeWarningLimit: 2000,
  },
});

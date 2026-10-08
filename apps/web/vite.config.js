import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        mint: resolve(__dirname, 'mint.html'),
        collection: resolve(__dirname, 'collection.html'),
        howItWorks: resolve(__dirname, 'how-it-works.html'),
        faq: resolve(__dirname, 'faq.html')
      }
    }
  }
});

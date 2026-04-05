import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  appType: 'spa',
  base: process.env.BASE_PATH ?? '/',
  root: 'src',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(currentDirectory, 'src/index.html'),
        notFound: path.resolve(currentDirectory, 'src/404.html')
      }
    }
  }
});

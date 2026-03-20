import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    include: ["msgpackr"],
    exclude: ['@noir-lang/noir_js', '@aztec/bb.js'],
  },
  build: {
    commonjsOptions: {
      include: [/msgpackr/, /node_modules/]
    }
  }
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy':   'same-origin',
    },
  },
});

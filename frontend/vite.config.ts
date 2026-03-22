import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      globals: { Buffer: true, global: true, process: true },
      protocolImports: true,
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    exclude: ['@noir-lang/noir_js', '@aztec/bb.js'],
    include: ['msgpackr'],
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      // /bb-async.js is served as a static public asset — not a bundled module.
      // Tell Rollup to leave it alone and let the browser fetch it at runtime.
      external: ['/bb-async.js'],
    },
  },
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy':   'same-origin',
    },
  },
});

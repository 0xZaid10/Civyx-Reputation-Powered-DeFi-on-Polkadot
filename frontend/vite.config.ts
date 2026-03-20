import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      protocolImports: true,
    }),
  ],

  // ✅ Required for Noir + bb.js WASM
  assetsInclude: ["**/*.wasm"],

  optimizeDeps: {
    // ✅ Prevent Vite from breaking bb.js
    exclude: ["@aztec/bb.js"],
  },

  build: {
    target: "esnext",
  },

  resolve: {
    alias: {
      // ✅ Force browser version of bb.js
      "@aztec/bb.js": path.resolve(
        __dirname,
        "node_modules/@aztec/bb.js/dest/browser/index.js"
      ),
    },
  },
});

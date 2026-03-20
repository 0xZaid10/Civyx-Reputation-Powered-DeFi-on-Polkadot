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

  // ✅ REQUIRED for bb.js + noir WASM
  assetsInclude: ["**/*.wasm"],

  optimizeDeps: {
    // ✅ Prevent Vite from breaking bb.js
    exclude: ["@aztec/bb.js"],
  },

  build: {
    target: "esnext",

    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        proof: path.resolve(__dirname, "proof.html"),
        report: path.resolve(__dirname, "report.html"),
      },
    },
  },

  resolve: {
    alias: {
      // ✅ Force browser build of bb.js (CRITICAL)
      "@aztec/bb.js": path.resolve(
        __dirname,
        "node_modules/@aztec/bb.js/dest/browser/index.js"
      ),
    },
  },
});

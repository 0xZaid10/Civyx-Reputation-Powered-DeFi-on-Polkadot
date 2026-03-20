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

  // ✅ VERY IMPORTANT for WASM (bb.js + noir)
  assetsInclude: ["**/*.wasm"],

  optimizeDeps: {
    // ❗ Prevent Vite from breaking bb.js + WASM
    exclude: ["garaga", "@aztec/bb.js"],
    esbuildOptions: {
      conditions: ["browser"],
    },
  },

  build: {
    target: "esnext",

    // ✅ Fix large ZK bundles + chunking
    chunkSizeWarningLimit: 2000,

    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        proof: path.resolve(__dirname, "proof.html"),
        report: path.resolve(__dirname, "report.html"),
      },

      output: {
        manualChunks: {
          // ✅ Split heavy ZK stack
          bb: ["@aztec/bb.js"],
          noir: ["@noir-lang/noir_js"],
        },
      },
    },
  },

  server: {
    headers: {
      // ✅ Needed if you ever enable threads (SharedArrayBuffer)
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },

  resolve: {
    conditions: ["browser", "module", "import", "default"],
    alias: {
      // ✅ Force browser build of bb.js
      "@aztec/bb.js": path.resolve(
        __dirname,
        "node_modules/@aztec/bb.js/dest/browser/index.js"
      ),

      // ✅ Fix pino (used internally)
      pino: "pino/browser.js",
    },
  },
});

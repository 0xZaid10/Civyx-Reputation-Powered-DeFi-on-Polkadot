import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
  optimizeDeps: {
    // bb.js and noir_js ship their own WASM bundles.
    // Excluding prevents Vite from breaking WASM loading and worker resolution.
    exclude: ["@aztec/bb.js", "@noir-lang/noir_js"],
    esbuildOptions: {
      conditions: ["browser"],
    },
  },
  build: {
    target: "esnext",
  },
  resolve: {
    conditions: ["browser", "module", "import", "default"],
    alias: {
      "@": path.resolve(__dirname, "src"),
      // Point bb.js explicitly to its browser build
      "@aztec/bb.js": path.resolve(
        __dirname,
        "node_modules/@aztec/bb.js/dest/browser/index.js"
      ),
      // Shim msgpackr so bb.js browser bundle resolves it
      "msgpackr": path.resolve(__dirname, "src/shims/msgpackr.ts"),
    },
  },
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
});

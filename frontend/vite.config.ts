import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  assetsInclude: ["**/*.wasm"],
  optimizeDeps: {
    exclude: ["@aztec/bb.js"],
    include: ["msgpackr"],
  },
  build: {
    target: "esnext",
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // Point bb.js to its browser bundle
      "@aztec/bb.js": path.resolve(
        __dirname,
        "node_modules/@aztec/bb.js/dest/browser/index.js"
      ),
      "msgpackr": path.resolve(__dirname, "src/shims/msgpackr.ts"),
    },
  },
  server: {
    headers: {
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
    },
  },
});

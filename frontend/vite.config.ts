import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],

  assetsInclude: ["**/*.wasm"],

  optimizeDeps: {
    exclude: ["@aztec/bb.js"],
  },

  build: {
    target: "esnext",
  },

  resolve: {
    alias: {
      "@aztec/bb.js": path.resolve(
        __dirname,
        "node_modules/@aztec/bb.js/dest/browser/index.js"
      ),
    },
  },
});

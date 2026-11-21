/// <reference types="vitest" />
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const apiTarget = process.env.VITE_DEV_API ?? "http://localhost:8000";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["leaf.svg"],
      manifest: {
        name: "LeafScan – plant disease checker",
        short_name: "LeafScan",
        description: "Photograph a leaf to check it for 38 plant diseases, with treatment guidance.",
        theme_color: "#183a2c",
        background_color: "#f3f5ef",
        display: "standalone",
        start_url: "/",
        icons: [{ src: "leaf.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
      },
      workbox: {
        // The 16 MB model and ONNX Runtime are cached on demand (see offline/engine.ts),
        // not precached, so first visits stay light.
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
        globIgnores: ["**/ort/**", "**/model/**"],
        navigateFallbackDenylist: [/^\/api\//, /^\/docs/],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: {
    port: 3000,
    host: true,
    proxy: { "/api": { target: apiTarget, changeOrigin: true } },
  },
  preview: { port: 3000, host: true },
  build: {
    outDir: "dist",
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          query: ["@tanstack/react-query"],
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});

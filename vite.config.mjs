import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { readBuildVersion } from "./scripts/build-version.mjs";

export default defineConfig({
  define: {
    __MAGNETAR_VERSION__: JSON.stringify(readBuildVersion()),
  },
  build: {
    outDir: "dist/client",
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [
    react(),
    VitePWA({
      manifest: false,
      strategies: "injectManifest",
      srcDir: "src",
      filename: "service-worker.js",
      registerType: "prompt",
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,png,webmanifest}"],
      },
    }),
  ],
});

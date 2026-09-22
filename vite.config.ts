import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    include: ["src/**/*.test.ts", "firebase.config.test.ts"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replaceAll("\\", "/");
          if (normalizedId.includes("/node_modules/firebase/") || normalizedId.includes("/node_modules/@firebase/")) {
            return "firebase";
          }
          if (
            normalizedId.includes("/node_modules/react/") ||
            normalizedId.includes("/node_modules/react-dom/")
          ) {
            return "react-vendor";
          }
        },
      },
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
});

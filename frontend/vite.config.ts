import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }) => {
  const isMobile = mode === "mobile";

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    define: {
      __IS_MOBILE__: isMobile,
    },
    build: {
      outDir: isMobile ? "dist" : "../backend/public",
      emptyOutDir: true,
    },
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: "http://localhost:3000",
          changeOrigin: true,
        },
      },
    },
  };
});
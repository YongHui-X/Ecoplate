import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }) => {
  const isMobile = mode === "mobile";

  return {
    base: mode === "production" ? "/ecolocker/" : "/",
    plugins: [react()],
    define: {
      __IS_MOBILE__: isMobile,
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      host: true,
      port: 5174,
      proxy: {
        "/api": {
          target: "http://localhost:3000",
          changeOrigin: true,
        },
      },
    },
    build: {
      // Ensure sourcemaps for debugging on mobile
      sourcemap: isMobile ? true : false,
    },
  };
});

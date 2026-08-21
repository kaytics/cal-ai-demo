import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The shell (ASGI) serves the AG-UI SSE endpoint; proxy /agui to it in dev.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/agui": "http://127.0.0.1:8080",
    },
  },
});

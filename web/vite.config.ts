import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev proxy: the SPA calls same-origin /agui/*, forwarded to the Python shell.
// Port 8090 (8080 is blocked on this box) — start it with `SHELL_PORT=8090 uv run api`.
const SHELL = process.env.SHELL_URL ?? "http://127.0.0.1:8090";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/agui": { target: SHELL, changeOrigin: true },
    },
  },
});

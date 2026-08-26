import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The generated Zod contract lives in the repo-root shared/ boundary (#11),
// imported here as `@contract` so web/src never reaches across the tree by path.
const contract = fileURLToPath(new URL("../shared/tool-result.ts", import.meta.url));
// shared/ lives outside web/, so bare imports in the generated contract (zod)
// can't resolve via node_modules ancestry — point them at web's own copy.
const zod = fileURLToPath(new URL("./node_modules/zod", import.meta.url));

// Dev proxy: the SPA calls same-origin /agui/*, forwarded to the Python shell.
// Port 8090 (8080 is blocked on this box) — start it with `SHELL_PORT=8090 uv run api`.
const SHELL = process.env.SHELL_URL ?? "http://127.0.0.1:8090";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@contract": contract, zod },
  },
  server: {
    proxy: {
      "/agui": { target: SHELL, changeOrigin: true },
    },
  },
});

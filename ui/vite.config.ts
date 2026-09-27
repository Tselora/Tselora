import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const collector =
  process.env.TSELOA_COLLECTOR_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/v1": {
        target: collector,
        changeOrigin: true,
        ws: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
  },
});

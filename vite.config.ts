import { defineConfig } from "vite";
export default defineConfig({
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
        ws: true,
        configure(proxy) {
          // Preserve same-origin checks across the local development proxy only.
          proxy.on("proxyReq", (outgoing, incoming) => {
            const origin = incoming.headers.origin;
            const host = incoming.headers.host;
            if (origin === `http://${host}` || origin === `https://${host}`)
              outgoing.setHeader("Origin", "http://127.0.0.1:8787");
          });
        },
      },
    },
  },
  build: { target: "es2022" },
});

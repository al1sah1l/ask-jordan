
import { createServer } from "vite";
import vue from "@vitejs/plugin-vue";

const server = await createServer({
  root: new URL(".", import.meta.url).pathname,
  plugins: [vue()],

  server: {
    host: "127.0.0.1",
    port: 8080,
    strictPort: true,

    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: false,
      },
    },
  },
});

await server.listen();
server.printUrls();


import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { canonicalLocalOrigin, localSessionProxy } from "./local-session-proxy.ts";

const server = await createServer({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [canonicalLocalOrigin()],

  server: {
    host: "127.0.0.1",
    port: 8080,
    strictPort: true,

    proxy: {
      "/api": localSessionProxy(),
    },
  },
});

await server.listen();
server.printUrls();

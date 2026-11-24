import type { Plugin, ProxyOptions } from "vite";

const SESSION = "__Host-ask-jordan-session";
const LOCAL_SESSION = "ask-jordan-local-session";

/** Used only by the loopback HTTP development server, never the production host. */
export function localSessionProxy(): ProxyOptions {
  return {
    target: "http://127.0.0.1:3000",
    changeOrigin: false,
    configure(proxy) {
      proxy.on("proxyReq", (outgoing, incoming) => {
        const cookies = incoming.headers.cookie?.split(";").map(part => part.trim());
        if (!cookies) return;

        const local = cookies.find(part => part.startsWith(`${LOCAL_SESSION}=`));

        // The backend continues to authenticate its normal, transport-owned cookie.
        const forwarded = cookies.filter(part =>
          !part.startsWith(`${LOCAL_SESSION}=`) && !part.startsWith(`${SESSION}=`),
        );
        if (local) forwarded.push(`${SESSION}=${local.slice(LOCAL_SESSION.length + 1)}`);
        if (forwarded.length) outgoing.setHeader("cookie", forwarded.join("; "));
        else outgoing.removeHeader("cookie");
      });

      proxy.on("proxyRes", response => {
        const cookies = response.headers["set-cookie"];
        if (!cookies) return;

        response.headers["set-cookie"] = cookies.map(cookie => {
          if (!cookie.startsWith(`${SESSION}=`)) return cookie;
          // Secure-prefixed cookies cannot be used reliably over local HTTP.
          // Preserve HttpOnly, SameSite, path, expiry, and sign-out clearing.
          return cookie.replace(`${SESSION}=`, `${LOCAL_SESSION}=`)
            .replace(/;\s*Secure(?=;|$)/gi, "");
        });
      });
    },
  };
}

export function canonicalLocalOrigin(): Plugin {
  return {
    name: "canonical-local-origin",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.headers.host !== "localhost:8080") return next();
        response.writeHead(307, { Location: `http://127.0.0.1:8080${request.url ?? "/"}` });
        response.end();
      });
    },
  };
}

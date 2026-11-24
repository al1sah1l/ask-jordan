import { afterAll, beforeAll, expect, test } from "bun:test";
import { createServer, type ViteDevServer } from "vite";
import { createGateway } from "@mit-sdg/sync-engine/boundary";
import { createHttpHandler } from "@mit-sdg/sync-engine-http/handler";
import { assembleApplication } from "../src/assembly.ts";
import { policy } from "../src/http.ts";
import { canonicalLocalOrigin, localSessionProxy } from "../web/local-session-proxy.ts";
import { openTestDb, type TestDb } from "./test-db.ts";

const ORIGIN = "http://127.0.0.1:8080";
let database: TestDb;
let backend: ReturnType<typeof Bun.serve>;
let frontend: ViteDevServer;
let url: string;

beforeAll(async () => {
  database = await openTestDb();
  const application = assembleApplication(database.db);
  backend = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: createHttpHandler({ application, gateway: createGateway({ application }), policy }),
  });
  frontend = await createServer({
    configFile: false,
    root: `${import.meta.dir}/../web`,
    plugins: [canonicalLocalOrigin()],
    server: {
      host: "127.0.0.1",
      port: 0,
      proxy: { "/api": { ...localSessionProxy(), target: backend.url.toString() } },
    },
  });
  await frontend.listen();
  const address = frontend.httpServer!.address();
  if (!address || typeof address === "string") throw new Error("Missing frontend port");
  url = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await frontend?.close();
  await backend?.stop(true);
  await database?.close();
});

async function post(path: string, body = {}, cookie?: string, origin = ORIGIN) {
  return fetch(`${url}/api${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

test("local HTTP registration retains its session through profile creation, sign-out, and sign-in", async () => {
  const credentials = { username: "local-proxy-test", password: "LocalTest123!" };
  const registered = await post("/auth/register", credentials);
  expect(registered.status).toBe(200);
  expect(await registered.json()).toEqual({ account: credentials.username });
  const issued = registered.headers.get("set-cookie")!;
  expect(issued).toStartWith("ask-jordan-local-session=");
  expect(issued).toContain("HttpOnly");
  expect(issued).toContain("SameSite=Strict");
  expect(issued).toContain("Path=/");
  expect(issued).toContain("Expires=");
  expect(issued).not.toMatch(/;\s*Secure(?:;|$)/i);
  const cookie = issued.split(";")[0]!;
  const oldSecureCookie = cookie.replace("ask-jordan-local-session=", "__Host-ask-jordan-session=");
  // An old backend cookie must not silently sign the browser back in after sign-out.
  expect((await post("/auth/current", {}, oldSecureCookie)).status).toBe(401);

  const current = await post("/auth/current", {}, `${oldSecureCookie}; ${cookie}`);
  expect(current.status).toBe(200);
  expect(await current.json()).toEqual({ account: credentials.username });
  expect((await post("/account/profile", {}, cookie)).status).toBe(404);
  const created = await post("/account/create", { name: "Local Tester", about: "Testing" }, cookie);
  expect(created.status).toBe(200);
  const profile = await post("/account/profile", {}, cookie);
  expect(profile.status).toBe(200);
  expect(await profile.json()).toMatchObject({ name: "Local Tester", about: "Testing" });

  expect((await post("/auth/current", {}, cookie, "http://evil.example")).status).toBe(403);
  const signedOut = await post("/auth/sign-out", {}, cookie);
  expect(signedOut.status).toBe(200);
  expect(signedOut.headers.get("set-cookie")).toStartWith("ask-jordan-local-session=;");
  expect(signedOut.headers.get("set-cookie")).toContain("Max-Age=0");
  expect((await post("/auth/current", {}, cookie)).status).toBe(401);

  const signedIn = await post("/auth/sign-in", credentials);
  expect(signedIn.status).toBe(200);
  const newCookie = signedIn.headers.get("set-cookie")!.split(";")[0]!;
  expect(newCookie).not.toBe(cookie);
  expect((await post("/auth/current", {}, newCookie)).status).toBe(200);
});

test("localhost navigation redirects to the configured origin before serving the app", async () => {
  const response = await fetch(`${url}/?test=1`, {
    headers: { Host: "localhost:8080" },
    redirect: "manual",
  });
  expect(response.status).toBe(307);
  expect(response.headers.get("location")).toBe(`${ORIGIN}/?test=1`);
});

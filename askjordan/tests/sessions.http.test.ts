/**
 * Register, sign-in, the current account, and sign-out through the HTTP handler.
 * The handler is called directly, so no server is started. Each test uses a
 * throwaway database.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { openTestDb, type TestDb } from "./test-db.ts";

// Bun loads `.env` from the shell directory. This file is also run from the repo root.
if (!process.env.MONGODB_URL) {
  const envFile = readFileSync(join(import.meta.dir, "../.env"), "utf8");
  const value = envFile.match(/^MONGODB_URL=(.*)$/m)?.[1]?.trim();
  if (value) process.env.MONGODB_URL = value;
}

const { createGateway } = await import("@mit-sdg/sync-engine/boundary");
const { createHttpHandler } = await import("@mit-sdg/sync-engine-http/handler");
const { assembleApplication } = await import("../src/assembly.ts");
const { policy } = await import("../src/http.ts");

const ORIGIN = "http://127.0.0.1:8080";
const USERNAME = "sam";
const EMAIL = "sam@example.com";
const PASSWORD = "long-enough";

let testDb: TestDb;
let handle: (request: Request) => Promise<Response>;

beforeAll(async () => {
  testDb = await openTestDb();
});

beforeEach(async () => {
  await testDb.db.dropDatabase();
  const application = assembleApplication(testDb.db);
  handle = createHttpHandler({ application, gateway: createGateway({ application }), policy });
});

afterAll(async () => {
  await testDb?.close();
});

async function post(path: string, body: object, cookie?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Origin: ORIGIN,
  };
  if (cookie) headers.Cookie = cookie;
  const response = await handle(
    new Request(`http://127.0.0.1:3000/api${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
  );
  return {
    status: response.status,
    body: await response.json(),
    setCookie: response.headers.get("set-cookie"),
  };
}

function sessionCookie(setCookie: string | null): string {
  expect(setCookie).toContain("ask-jordan-session=");
  expect(setCookie).toContain("HttpOnly");
  expect(setCookie).toStartWith("__Host-ask-jordan-session=");
  expect(setCookie).toContain("; Secure");
  return setCookie!.split(";")[0]!;
}

function sessionCount(): Promise<number> {
  return testDb.db.collection("sessioning.sessions").countDocuments();
}

test("register then current returns the same account", async () => {
  const registered = await post("/auth/register", { username: USERNAME, email: EMAIL, password: PASSWORD });
  expect(registered.status).toBe(200);
  expect(registered.body).toEqual({ account: USERNAME });
  const cookie = sessionCookie(registered.setCookie);

  const current = await post("/auth/current", {}, cookie);
  expect(current.status).toBe(200);
  expect(current.body).toEqual({ account: USERNAME });
});

test("sign-in with the right password starts a new session", async () => {
  const registered = await post("/auth/register", { username: USERNAME, email: EMAIL, password: PASSWORD });
  const first = sessionCookie(registered.setCookie);

  const signedIn = await post("/auth/sign-in", { username: USERNAME, password: PASSWORD });
  expect(signedIn.status).toBe(200);
  expect(signedIn.body).toEqual({ account: USERNAME });
  const second = sessionCookie(signedIn.setCookie);
  expect(second).not.toBe(first);
  expect(await sessionCount()).toBe(2);

  const current = await post("/auth/current", {}, second);
  expect(current.body).toEqual({ account: USERNAME });
});

test("a wrong password is refused and starts no session", async () => {
  await post("/auth/register", { username: USERNAME, email: EMAIL, password: PASSWORD });
  expect(await sessionCount()).toBe(1);

  const refused = await post("/auth/sign-in", { username: USERNAME, password: "not-the-password" });
  expect(refused.status).toBe(401);
  expect(refused.body).toEqual({ error: "UNAUTHORIZED" });
  expect(refused.setCookie).toBeNull();
  expect(await sessionCount()).toBe(1);
});

test("after sign-out, current and a second sign-out are refused", async () => {
  const registered = await post("/auth/register", { username: USERNAME, email: EMAIL, password: PASSWORD });
  const cookie = sessionCookie(registered.setCookie);

  const signedOut = await post("/auth/sign-out", {}, cookie);
  expect(signedOut.status).toBe(200);
  expect(signedOut.body).toEqual({ ended: true });
  expect(await sessionCount()).toBe(0);

  const current = await post("/auth/current", {}, cookie);
  expect(current.status).toBe(401);
  expect(current.body).toEqual({ error: "UNAUTHORIZED" });

  const again = await post("/auth/sign-out", {}, cookie);
  expect(again.status).toBe(401);
  expect(again.body).toEqual({ error: "UNAUTHORIZED" });
});

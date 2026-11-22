/**
 * Create, update, and read a profile through the HTTP handler.
 * The handler is called directly, so no server is started.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { openTestDb, type TestDb } from "./test-db.ts";

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

async function signIn(): Promise<string> {
  const registered = await post("/auth/register", { username: USERNAME, password: PASSWORD });
  expect(registered.status).toBe(200);
  expect(registered.setCookie).toContain("ask-jordan-session=");
  return registered.setCookie!.split(";")[0]!;
}

test("create then read returns the same profile", async () => {
  const cookie = await signIn();
  const created = await post("/account/create", { name: "Sam", about: "likes movies" }, cookie);
  expect(created.status).toBe(200);
  expect(created.body).toEqual({ profile: USERNAME });

  const profile = await post("/account/profile", {}, cookie);
  expect(profile.status).toBe(200);
  expect(profile.body).toEqual({ profile: USERNAME, name: "Sam", about: "likes movies" });
});

test("a blank name is refused and no profile is stored", async () => {
  const cookie = await signIn();
  const refused = await post("/account/create", { name: "   ", about: "likes movies" }, cookie);
  expect(refused.status).toBe(400);
  expect(refused.body).toEqual({ error: "INVALID_REQUEST" });

  const profile = await post("/account/profile", {}, cookie);
  expect(profile.status).toBe(404);
  expect(profile.body).toEqual({ error: "NOT_FOUND" });
});

test("a second create is refused", async () => {
  const cookie = await signIn();
  await post("/account/create", { name: "Sam", about: "" }, cookie);
  const again = await post("/account/create", { name: "Samuel", about: "other" }, cookie);
  expect(again.status).toBe(409);
  expect(again.body).toEqual({ error: "CONFLICT" });

  const profile = await post("/account/profile", {}, cookie);
  expect(profile.body).toEqual({ profile: USERNAME, name: "Sam", about: "" });
});

test("update replaces the name and description", async () => {
  const cookie = await signIn();
  await post("/account/create", { name: "Sam", about: "" }, cookie);
  const updated = await post("/account/update", { name: "Sam B", about: "likes movies" }, cookie);
  expect(updated.status).toBe(200);
  expect(updated.body).toEqual({ profile: USERNAME });

  const profile = await post("/account/profile", {}, cookie);
  expect(profile.body).toEqual({ profile: USERNAME, name: "Sam B", about: "likes movies" });
});

test("create after sign-out is refused", async () => {
  const cookie = await signIn();
  const signedOut = await post("/auth/sign-out", {}, cookie);
  expect(signedOut.status).toBe(200);

  const refused = await post("/account/create", { name: "Sam", about: "" }, cookie);
  expect(refused.status).toBe(401);
  expect(refused.body).toEqual({ error: "UNAUTHORIZED" });
});

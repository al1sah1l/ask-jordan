/**
 * Email sign-in recovery through the HTTP handler. The mailer is replaced so
 * the test can read the link without sending email.
 */
import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { createGateway } from "@mit-sdg/sync-engine/boundary";
import { createHttpHandler } from "@mit-sdg/sync-engine-http/handler";
import { assembleApplication } from "../src/assembly.ts";
import { policy } from "../src/http.ts";
import { createRecoveryHandler } from "../src/recoveryHttp.ts";
import { openTestDb, type TestDb } from "./test-db.ts";

const ORIGIN = "http://127.0.0.1:8080";
const USERNAME = "sam";
const EMAIL = "sam@example.com";
const PASSWORD = "long-enough";

let testDb: TestDb;
let api: (request: Request) => Promise<Response>;
let sent: { email: string; link: string }[];

beforeAll(async () => {
  testDb = await openTestDb();
});

beforeEach(async () => {
  await testDb.db.dropDatabase();
  sent = [];
  const application = assembleApplication(testDb.db);
  const engine = createHttpHandler({ application, gateway: createGateway({ application }), policy });
  const recovery = createRecoveryHandler(testDb.db, async (email, link) => {
    sent.push({ email, link });
  });
  api = (request) => {
    const path = new URL(request.url).pathname;
    return path === "/api/auth/recover" || path === "/api/auth/reset" ? recovery(request) : engine(request);
  };
});

afterAll(async () => {
  await testDb?.close();
});

function post(path: string, body: object, origin = ORIGIN) {
  return api(new Request(`http://127.0.0.1:3000/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(body),
  }));
}

test("a reset link replaces the password and signs the account in", async () => {
  const registered = await post("/auth/register", { username: USERNAME, email: EMAIL, password: PASSWORD });
  expect(registered.status).toBe(200);

  const requested = await post("/auth/recover", { email: "Sam@Example.com" });
  expect(requested.status).toBe(200);
  expect(await requested.json()).toEqual({ accepted: true });
  expect(sent).toHaveLength(1);
  expect(sent[0]!.email).toBe(EMAIL);
  const token = new URL(sent[0]!.link).searchParams.get("reset");
  expect(token).toBeTruthy();

  const unknown = await post("/auth/recover", { email: "missing@example.com" });
  expect(unknown.status).toBe(200);
  expect(await unknown.json()).toEqual({ accepted: true });
  expect(sent).toHaveLength(1);

  const reset = await post("/auth/reset", { token, password: "fresh-password" });
  expect(reset.status).toBe(200);
  expect(await reset.json()).toEqual({ account: USERNAME });
  expect(reset.headers.get("set-cookie")).toContain("__Host-ask-jordan-session=");

  const oldPassword = await post("/auth/sign-in", { username: USERNAME, password: PASSWORD });
  expect(oldPassword.status).toBe(401);
  const signedIn = await post("/auth/sign-in", { username: USERNAME, password: "fresh-password" });
  expect(signedIn.status).toBe(200);
  expect(await signedIn.json()).toEqual({ account: USERNAME });

  const reused = await post("/auth/reset", { token, password: "another-password" });
  expect(reused.status).toBe(400);
  expect(await reused.json()).toEqual({ error: "INVALID_RECOVERY" });
});

test("a malformed email and a foreign origin are refused", async () => {
  const malformed = await post("/auth/recover", { email: "not-an-email" });
  expect(malformed.status).toBe(400);
  expect(await malformed.json()).toEqual({ error: "INVALID_EMAIL" });
  expect(sent).toHaveLength(0);

  const foreign = await post("/auth/recover", { email: EMAIL }, "http://evil.example");
  expect(foreign.status).toBe(403);
});

import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import {
  AuthenticatingConcept,
  EmailTaken,
  InvalidCredentials,
  InvalidEmail,
  InvalidRecovery,
  InvalidUsername,
  UsernameTaken,
  WeakPassword,
} from "../../src/concepts/Authenticating.ts";
import { openTestDb, type TestDb } from "../test-db.ts";

let testDb: TestDb;
let now = new Date("2026-11-25T12:00:00Z");
let authenticating: AuthenticatingConcept;

beforeAll(async () => {
  testDb = await openTestDb();
});

beforeEach(async () => {
  await testDb.db.dropDatabase();
  now = new Date("2026-11-25T12:00:00Z");
  authenticating = new AuthenticatingConcept(testDb.db, () => now);
});

afterAll(async () => {
  await testDb?.close();
});

test("principle: a registered user signs in with the username and the right password only", async () => {
  const { account } = await authenticating.register({
    username: "sam",
    email: "Sam@Example.com",
    password: "long-enough",
  });
  expect(account).toBe("sam");

  await expect(authenticating.register({
    username: "sam",
    email: "other@example.com",
    password: "another-one",
  })).rejects.toBeInstanceOf(UsernameTaken);
  await expect(authenticating.register({
    username: "samantha",
    email: "sam@example.com",
    password: "another-one",
  })).rejects.toBeInstanceOf(EmailTaken);
  await expect(authenticating.authenticate({ username: "sam", password: "wrong-password" }))
    .rejects.toBeInstanceOf(InvalidCredentials);
  await expect(authenticating.authenticate({ username: "nobody", password: "long-enough" }))
    .rejects.toBeInstanceOf(InvalidCredentials);
  expect(await authenticating.authenticate({ username: "sam", password: "long-enough" })).toEqual({
    account: "sam",
  });
});

test("usernames, emails, and passwords outside the allowed shape are refused", async () => {
  await expect(authenticating.register({
    username: "sam smith",
    email: "sam@example.com",
    password: "long-enough",
  })).rejects.toBeInstanceOf(InvalidUsername);
  await expect(authenticating.register({
    username: "ab",
    email: "sam@example.com",
    password: "long-enough",
  })).rejects.toBeInstanceOf(InvalidUsername);
  await expect(authenticating.register({
    username: "alex",
    email: "not-an-email",
    password: "long-enough",
  })).rejects.toBeInstanceOf(InvalidEmail);
  await expect(authenticating.register({
    username: "alex",
    email: "alex@example.com",
    password: "short",
  })).rejects.toBeInstanceOf(WeakPassword);
  await expect(authenticating.register({
    username: "alex",
    email: "alex@example.com",
    password: "long-enough",
  })).resolves.toEqual({ account: "alex" });
});

test("the password is not stored as written", async () => {
  await authenticating.register({ username: "alex", email: "alex@example.com", password: "long-enough" });
  const stored = await testDb.db.collection("authenticating.accounts").findOne({ _id: "alex" as never });
  expect(JSON.stringify(stored)).not.toContain("long-enough");
  expect(stored).toMatchObject({ email: "alex@example.com" });
});

test("a recovery token changes the password once and then stops working", async () => {
  await authenticating.register({ username: "sam", email: "sam@example.com", password: "long-enough" });
  expect(await authenticating.requestRecovery({ email: "missing@example.com" })).toEqual({ token: "" });

  const { token } = await authenticating.requestRecovery({ email: "sam@example.com" });
  expect(token.length).toBeGreaterThan(20);
  const stored = await testDb.db.collection("authenticating.recoveries").findOne({ account: "sam" });
  expect(JSON.stringify(stored)).not.toContain(token);

  now = new Date(now.getTime() + 30_000);
  expect(await authenticating.requestRecovery({ email: "sam@example.com" })).toEqual({ token: "" });

  await expect(authenticating.resetPassword({ token, password: "short" })).rejects.toBeInstanceOf(WeakPassword);
  expect(await authenticating.resetPassword({ token, password: "fresh-password" })).toEqual({ account: "sam" });
  await expect(authenticating.authenticate({ username: "sam", password: "long-enough" }))
    .rejects.toBeInstanceOf(InvalidCredentials);
  expect(await authenticating.authenticate({ username: "sam", password: "fresh-password" })).toEqual({
    account: "sam",
  });
  await expect(authenticating.resetPassword({ token, password: "another-password" }))
    .rejects.toBeInstanceOf(InvalidRecovery);
});

test("an expired recovery token is refused", async () => {
  await authenticating.register({ username: "sam", email: "sam@example.com", password: "long-enough" });
  const { token } = await authenticating.requestRecovery({ email: "sam@example.com" });
  now = new Date(now.getTime() + 6 * 60 * 1000);
  await expect(authenticating.resetPassword({ token, password: "fresh-password" }))
    .rejects.toBeInstanceOf(InvalidRecovery);
  expect(await authenticating.authenticate({ username: "sam", password: "long-enough" })).toEqual({
    account: "sam",
  });
});

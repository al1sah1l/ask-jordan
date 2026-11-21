import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import {
  AuthenticatingConcept,
  InvalidCredentials,
  InvalidUsername,
  UsernameTaken,
  WeakPassword,
} from "../../src/concepts/Authenticating.ts";
import { openTestDb, type TestDb } from "../test-db.ts";

let testDb: TestDb;
let authenticating: AuthenticatingConcept;

beforeAll(async () => {
  testDb = await openTestDb();
});

beforeEach(async () => {
  await testDb.db.dropDatabase();
  authenticating = new AuthenticatingConcept(testDb.db);
});

afterAll(async () => {
  await testDb?.close();
});

test("principle: a registered user authenticates with the right password only", async () => {
  const { account } = await authenticating.register({ username: "sam", password: "long-enough" });
  expect(account).toBe("sam");

  await expect(
    authenticating.register({ username: "sam", password: "another-one" }),
  ).rejects.toBeInstanceOf(UsernameTaken);
  await expect(
    authenticating.authenticate({ username: "sam", password: "wrong-password" }),
  ).rejects.toBeInstanceOf(InvalidCredentials);
  expect(await authenticating.authenticate({ username: "sam", password: "long-enough" })).toEqual({
    account: "sam",
  });
});

test("an unknown username is refused the same way as a wrong password", async () => {
  await expect(
    authenticating.authenticate({ username: "nobody", password: "whatever-1" }),
  ).rejects.toBeInstanceOf(InvalidCredentials);
});

test("usernames and passwords outside the allowed shape are refused", async () => {
  await expect(
    authenticating.register({ username: "sam smith", password: "long-enough" }),
  ).rejects.toBeInstanceOf(InvalidUsername);
  await expect(authenticating.register({ username: "ab", password: "long-enough" })).rejects.toBeInstanceOf(
    InvalidUsername,
  );
  await expect(authenticating.register({ username: "alex", password: "short" })).rejects.toBeInstanceOf(
    WeakPassword,
  );
  // A refused registration creates no account, so the name is still free.
  await expect(authenticating.register({ username: "alex", password: "long-enough" })).resolves.toEqual({
    account: "alex",
  });
});

test("the password is not stored as written", async () => {
  await authenticating.register({ username: "alex", password: "long-enough" });
  const stored = await testDb.db.collection("authenticating.accounts").findOne({ _id: "alex" as never });
  expect(JSON.stringify(stored)).not.toContain("long-enough");
});

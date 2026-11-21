import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { AccountConcept, BlankName, NoProfile, ProfileExists } from "../../src/concepts/Account.ts";
import { openTestDb, type TestDb } from "../test-db.ts";

let testDb: TestDb;
let accounts: AccountConcept;

beforeAll(async () => {
  testDb = await openTestDb();
});

beforeEach(async () => {
  await testDb.db.dropDatabase();
  accounts = new AccountConcept(testDb.db);
});

afterAll(async () => {
  await testDb?.close();
});

test("principle: a user saves a name and description and can change them", async () => {
  expect(await accounts.createAccount({ user: "sam", name: "Sam", about: "" })).toEqual({ profile: "sam" });
  expect(await accounts.getProfile({ user: "sam" })).toEqual({ profile: "sam", name: "Sam", about: "" });

  expect(await accounts.updateProfile({ user: "sam", name: "Sam A.", about: "likes soccer" })).toEqual({
    profile: "sam",
  });
  expect(await accounts.getProfile({ user: "sam" })).toEqual({
    profile: "sam",
    name: "Sam A.",
    about: "likes soccer",
  });

  await expect(accounts.createAccount({ user: "sam", name: "Other", about: "" })).rejects.toBeInstanceOf(
    ProfileExists,
  );
});

test("a blank name is refused and does not replace a saved profile", async () => {
  await expect(accounts.createAccount({ user: "sam", name: "   ", about: "hello" })).rejects.toBeInstanceOf(
    BlankName,
  );
  await accounts.createAccount({ user: "sam", name: "Sam", about: "hello" });
  await expect(
    accounts.updateProfile({ user: "sam", name: " ", about: "changed" }),
  ).rejects.toBeInstanceOf(BlankName);
  expect(await accounts.getProfile({ user: "sam" })).toEqual({ profile: "sam", name: "Sam", about: "hello" });
});

test("a user without a profile cannot be read or updated", async () => {
  await expect(accounts.getProfile({ user: "sam" })).rejects.toBeInstanceOf(NoProfile);
  await expect(accounts.updateProfile({ user: "sam", name: "Sam", about: "" })).rejects.toBeInstanceOf(NoProfile);
});

test("a profile does not store interests", async () => {
  await accounts.createAccount({ user: "sam", name: "Sam", about: "likes movies" });
  const stored = await testDb.db.collection("account.profiles").findOne({ _id: "sam" as never });
  expect(Object.keys(stored ?? {}).sort()).toEqual(["_id", "about", "name"]);
});

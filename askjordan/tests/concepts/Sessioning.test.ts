import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { SessioningConcept, UnknownSession } from "../../src/concepts/Sessioning.ts";
import { openTestDb, type TestDb } from "../test-db.ts";

let testDb: TestDb;
let now: Date;
let sessioning: SessioningConcept;

beforeAll(async () => {
  testDb = await openTestDb();
});

beforeEach(async () => {
  await testDb.db.dropDatabase();
  now = new Date("2026-11-21T12:00:00Z");
  sessioning = new SessioningConcept(testDb.db, () => now);
});

afterAll(async () => {
  await testDb?.close();
});

test("principle: a session resolves to its user until it is ended", async () => {
  const { session, expiresAt } = await sessioning.start({ user: "sam" });
  expect(expiresAt.getTime()).toBe(now.getTime() + 24 * 60 * 60 * 1000);
  expect(await sessioning.current({ session })).toEqual({ user: "sam" });

  expect(await sessioning.end({ session })).toEqual({ ended: true });
  await expect(sessioning.current({ session })).rejects.toBeInstanceOf(UnknownSession);
  await expect(sessioning.end({ session })).rejects.toBeInstanceOf(UnknownSession);
});

test("an invented or missing session is refused", async () => {
  await expect(sessioning.current({ session: "made-up" })).rejects.toBeInstanceOf(UnknownSession);
  // The HTTP adapter passes null when the browser has no session cookie.
  await expect(sessioning.current({ session: null as never })).rejects.toBeInstanceOf(UnknownSession);
});

test("a session stops working once it expires", async () => {
  const { session } = await sessioning.start({ user: "alex" });
  now = new Date(now.getTime() + 24 * 60 * 60 * 1000 + 1);
  await expect(sessioning.current({ session })).rejects.toBeInstanceOf(UnknownSession);
});

test("two sessions for one user are independent", async () => {
  const first = await sessioning.start({ user: "sam" });
  const second = await sessioning.start({ user: "sam" });
  await sessioning.end({ session: first.session });
  expect(await sessioning.current({ session: second.session })).toEqual({ user: "sam" });
});

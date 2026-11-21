import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import {
  AlreadyHolds,
  AvatarCustomizingConcept,
  InvalidSlot,
  NoHoldings,
  NotHolding,
  NotWearing,
} from "../../src/concepts/AvatarCustomizing.ts";
import { openTestDb, type TestDb } from "../test-db.ts";

let testDb: TestDb;
let avatars: AvatarCustomizingConcept;

beforeAll(async () => {
  testDb = await openTestDb();
});

beforeEach(async () => {
  await testDb.db.dropDatabase();
  avatars = new AvatarCustomizingConcept(testDb.db);
});

afterAll(async () => {
  await testDb?.close();
});

test("principle: a granted item can be worn, replaced, and removed from a slot", async () => {
  await expect(avatars.getEquipped({ user: "sam" })).rejects.toBeInstanceOf(NoHoldings);

  expect(await avatars.grant({ user: "sam", item: "cap" })).toEqual({ user: "sam", item: "cap" });
  expect(await avatars.getEquipped({ user: "sam" })).toEqual({ worn: [] });

  expect(await avatars.equip({ user: "sam", item: "cap", slot: "HEAD" })).toEqual({
    user: "sam",
    slot: "HEAD",
    item: "cap",
  });
  await avatars.grant({ user: "sam", item: "scarf" });
  await avatars.equip({ user: "sam", item: "scarf", slot: "HEAD" });
  expect(await avatars.getEquipped({ user: "sam" })).toEqual({ worn: [{ slot: "HEAD", item: "scarf" }] });

  await avatars.clear({ user: "sam", slot: "HEAD" });
  expect(await avatars.getEquipped({ user: "sam" })).toEqual({ worn: [] });
  await avatars.equip({ user: "sam", item: "cap", slot: "HEAD" });
  expect(await avatars.getEquipped({ user: "sam" })).toEqual({ worn: [{ slot: "HEAD", item: "cap" }] });
});

test("an item is worn in only one slot, and two users stay separate", async () => {
  await avatars.grant({ user: "sam", item: "cap" });
  await avatars.equip({ user: "sam", item: "cap", slot: "HEAD" });
  await avatars.equip({ user: "sam", item: "cap", slot: "BODY" });
  expect(await avatars.getEquipped({ user: "sam" })).toEqual({ worn: [{ slot: "BODY", item: "cap" }] });

  await avatars.grant({ user: "alex", item: "cap" });
  expect(await avatars.getEquipped({ user: "alex" })).toEqual({ worn: [] });
});

test("grant, equip, and clear refuse the cases the concept excludes", async () => {
  await expect(avatars.equip({ user: "sam", item: "cap", slot: "HEAD" })).rejects.toBeInstanceOf(NotHolding);
  await avatars.grant({ user: "sam", item: "cap" });
  await expect(avatars.grant({ user: "sam", item: "cap" })).rejects.toBeInstanceOf(AlreadyHolds);
  await expect(avatars.equip({ user: "sam", item: "cap", slot: "HAND" })).rejects.toBeInstanceOf(InvalidSlot);
  await expect(avatars.clear({ user: "sam", slot: "HEAD" })).rejects.toBeInstanceOf(NotWearing);
  await expect(avatars.clear({ user: "sam", slot: "HAND" })).rejects.toBeInstanceOf(InvalidSlot);
});

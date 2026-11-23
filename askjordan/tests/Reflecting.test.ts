import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import sharp from "sharp";
import { MongoClient } from "mongodb";
import { ReflectingConcept, EditAmbiguousPage, ReadAmbiguousPage, SaveInvalidImage, SaveNoEntry, SaveTextTooLong, SaveTooManyImages, SaveImageTooLarge, ReflectionUnavailable } from "../src/concepts/Reflecting.ts";
import { insertBeforePngEnd, pngChunk } from "./image-fixtures.ts";
import type { Db } from "mongodb";
import { openTestDb, type TestDb } from "./test-db.ts";
let database: TestDb;
let concept: ReflectingConcept;
let png: string;
beforeAll(async () => {
  database = await openTestDb();
  png = `data:image/png;base64,${(await sharp({ create: { width: 8, height: 8, channels: 3, background: "red" } }).png().toBuffer()).toString("base64")}`;
});
beforeEach(async () => { await database.db.dropDatabase(); concept = new ReflectingConcept(database.db); });
afterAll(async () => { await database?.close(); });
const scope = { user: "alice", story: "story", chapter: "chapter-3" };

test("durable photo-only work, stable retry/replacement, removal, and owner isolation", async () => {
  const { page } = await concept.save({ ...scope, text: " ", images: [png] });
  const restarted = new ReflectingConcept(database.db);
  expect(await restarted.get(scope)).toEqual({ entry: { page, story: scope.story, chapter: scope.chapter, text: "", images: [png] } });
  expect(await restarted.save({ ...scope, text: " ", images: [png] })).toEqual({ page });
  expect(await restarted.save({ ...scope, text: "  I tried it.  ", images: [] })).toEqual({ page });
  expect((await restarted.get(scope)).entry).toEqual({ page, story: scope.story, chapter: scope.chapter, text: "I tried it.", images: [] });
  expect(await restarted.get({ ...scope, user: "bob" })).toEqual({ entry: null });
  expect(await database.db.collection("reflecting.pages").countDocuments({})).toBe(1);
  const stored = await database.db.collection("reflecting.pages").findOne({ page });
  expect(stored?.images).toEqual([]);
});

test("legacy write/edit preserve omitted photos and refuse ambiguous chapter selection", async () => {
  await concept.createJournal({ user: "alice" });
  const first = await concept.write({ user: "alice", story: "one", chapter: 3, text: "", images: [png] });
  await concept.edit({ user: "alice", chapter: 3, text: "  edited  " });
  expect((await concept.get({ user: "alice", story: "one", chapter: 3 })).entry?.images).toEqual([png]);
  expect(await concept.read({ user: "alice", chapter: 3 })).toEqual(first);
  await concept.write({ user: "alice", story: "two", chapter: 3, text: "second" });
  await expect(concept.edit({ user: "alice", chapter: 3, text: "ambiguous" })).rejects.toBeInstanceOf(EditAmbiguousPage);
  await expect(concept.read({ user: "alice", chapter: 3 })).rejects.toBeInstanceOf(ReadAmbiguousPage);
  await concept.edit({ user: "alice", story: "one", chapter: 3, text: "text only", images: [] });
  expect((await concept.getJournal({ user: "alice" })).pages.map((row) => row.story)).toEqual(["one", "two"]);
  expect((await concept.get({ user: "alice", story: "one", chapter: 3 })).entry?.page).toBe(first.page);
});

test("validation refuses bad replacements without changing stored bytes", async () => {
  await concept.save({ ...scope, text: "original", images: [png] });
  const cases: [unknown, unknown, new (...args: any[]) => Error][] = [
    ["", [], SaveNoEntry], ["x".repeat(5001), [], SaveTextTooLong], ["ok", [png, png, png, png], SaveTooManyImages],
    ["ok", [`data:image/png;base64,${Buffer.alloc(1048577).toString("base64")}`], SaveImageTooLarge],
    ["ok", [png.replace("image/png", "image/jpeg")], SaveInvalidImage],
    ["ok", ["https://example.com/image.png"], SaveInvalidImage],
    ["ok", ["data:image/svg+xml;base64,PHN2Zy8+"], SaveInvalidImage],
    ["ok", [png.slice(0, -12)], SaveInvalidImage], ["ok", ["data:image/png;base64,AB=="], SaveInvalidImage],
    ["ok", [12], SaveInvalidImage], ["ok", {}, SaveInvalidImage], [null, [], SaveNoEntry],
  ];
  // Keep a valid PNG header/dimensions while corrupting compressed pixels.
  const bytes = Buffer.from(png.split(",")[1]!, "base64");
  const idat = bytes.indexOf(Buffer.from("IDAT"));
  bytes[idat + 6] = bytes[idat + 6]! ^ 255;
  cases.push(["ok", [`data:image/png;base64,${bytes.toString("base64")}`], SaveInvalidImage]);
  const huge = await sharp({ create: { width: 4100, height: 4000, channels: 3, background: "white" } }).png().toBuffer();
  cases.push(["ok", [`data:image/png;base64,${huge.toString("base64")}`], SaveInvalidImage]);
  for (const [text, images, error] of cases) {
    await expect(concept.save({ ...scope, text, images } as never)).rejects.toBeInstanceOf(error);
    expect((await concept.get(scope)).entry).toMatchObject({ text: "original", images: [png] });
  }
});

test("JPEG and WebP are decoded and accepted; decoded size is bounded", async () => {
  for (const format of ["jpeg", "webp"] as const) {
    const bytes = await sharp({ create: { width: 4, height: 4, channels: 3, background: "blue" } })[format]().toBuffer();
    const image = `data:image/${format};base64,${bytes.toString("base64")}`;
    await concept.save({ ...scope, text: "", images: [image] });
    expect((await concept.get(scope)).entry?.images).toEqual([image]);
  }
});

test("concurrent replacements keep one stable page and one complete accepted value", async () => {
  const values = await Promise.all(Array.from({ length: 8 }, (_, i) => concept.save({ ...scope, text: `edit-${i}`, images: [] })));
  expect(new Set(values.map((value) => value.page)).size).toBe(1);
  expect(await database.db.collection("reflecting.pages").countDocuments({})).toBe(1);
  expect((await concept.get(scope)).entry?.text).toMatch(/^edit-[0-7]$/);
});

test("storage failure returns unavailable rather than absent, and previous bytes recover", async () => {
  await concept.save({ ...scope, text: "saved before outage", images: [png] });
  const disconnected = new MongoClient(process.env.MONGODB_URL!, { serverSelectionTimeoutMS: 25 });
  const unavailable = new ReflectingConcept(disconnected.db(database.db.databaseName));
  await disconnected.close();
  await expect(unavailable.get(scope)).rejects.toBeInstanceOf(ReflectionUnavailable);
  await expect(unavailable.save({ ...scope, text: "failed edit", images: [] })).rejects.toBeInstanceOf(ReflectionUnavailable);
  expect((await new ReflectingConcept(database.db).get(scope)).entry).toMatchObject({ text: "saved before outage", images: [png] });
});


test("multi-frame containers cannot hide corrupt later data behind valid first pixels", async () => {
  const original = Buffer.from(png.split(",")[1]!, "base64");
  const control = Buffer.alloc(8);
  control.writeUInt32BE(2, 0);
  const apng = insertBeforePngEnd(original, pngChunk("acTL", control));
  await expect(concept.save({ ...scope, text: "", images: [`data:image/png;base64,${apng.toString("base64")}`] })).rejects.toBeInstanceOf(SaveInvalidImage);
  const webp = await sharp(original).webp().toBuffer();
  const animation = Buffer.from("414e494d06000000000000000000414e4d460400000062616421", "hex");
  const animated = Buffer.concat([webp, animation]);
  animated.writeUInt32LE(animated.length - 8, 4);
  await expect(concept.save({ ...scope, text: "", images: [`data:image/webp;base64,${animated.toString("base64")}`] })).rejects.toBeInstanceOf(SaveInvalidImage);
});

test("a failed page operation preserves previous readable content after journal success", async () => {
  await concept.save({ ...scope, text: "original", images: [png] });
  const adapter = new Proxy(database.db, {
    get(target, property) {
      if (property === "collection") return (name: string) => {
        const collection = target.collection(name);
        return new Proxy(collection, {
          get(owner, method) {
            if (name === "reflecting.pages" && method === "findOneAndUpdate") return async () => { throw new Error("simulated page write failure"); };
            const value = Reflect.get(owner, method, owner);
            return typeof value === "function" ? value.bind(owner) : value;
          },
        });
      };
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as Db;
  await expect(new ReflectingConcept(adapter).save({ ...scope, text: "failed edit", images: [] })).rejects.toBeInstanceOf(ReflectionUnavailable);
  expect((await concept.get(scope)).entry).toMatchObject({ text: "original", images: [png] });
});

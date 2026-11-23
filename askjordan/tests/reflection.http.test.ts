import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import sharp from "sharp";
import { MongoClient } from "mongodb";
import { createGateway } from "@mit-sdg/sync-engine/boundary";
import { createHttpHandler } from "@mit-sdg/sync-engine-http/handler";
import { assembleApplication } from "../src/assembly.ts";
import { StoryGenerationConcept } from "../src/concepts/StoryGeneration.ts";
import { ReflectingConcept } from "../src/concepts/Reflecting.ts";
import { PreparedStoryGenerator } from "../src/ai/PreparedStoryGenerator.ts";
import { ApplicationPersistence } from "../src/persistence.ts";
import { seedCatalog } from "../src/catalog.ts";
import { policy } from "../src/http.ts";
import { insertBeforePngEnd, pngChunk } from "./image-fixtures.ts";
import { openTestDb, type TestDb } from "./test-db.ts";
let database: TestDb;
let app: ReturnType<typeof assembleApplication>;
let handle: ReturnType<typeof createHttpHandler>;
let png: string;
const origin = "http://127.0.0.1:8080";
function handler(application: typeof app) { return createHttpHandler({ application, gateway: createGateway({ application }), policy }); }
async function post(path: string, body: Record<string, unknown> = {}, cookie?: string) {
  const response = await handle(new Request(`http://127.0.0.1:3000/api${path}`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) }));
  return { status: response.status, body: await response.json() as Record<string, any>, cookie: response.headers.get("set-cookie")?.split(";")[0] };
}
async function register(username: string) {
  const result = await post("/auth/register", { username, password: "test-password-123" });
  expect(result.status).toBe(200);
  await app.concepts.Account.createAccount({ user: username, name: username, about: "" });
  return result.cookie!;
}
async function story(cookie: string, finish = true) {
  const activities = await post("/interests/activities", {}, cookie);
  const started = await post("/stories/start", { activity: activities.body.activities[0].activity }, cookie);
  expect(started.status).toBe(200);
  if (finish) {
    const second = await post("/stories/continue", { story: started.body.story, answer: "the crowd because I like expressions", expectedChapter: started.body.chapter }, cookie);
    expect(second.status).toBe(200);
    const final = await post("/stories/continue", { story: started.body.story, answer: "a close-up because of detail", expectedChapter: second.body.chapter }, cookie);
    expect(final.status).toBe(200);
    return { story: started.body.story as string, chapter: final.body.chapter as string };
  }
  return { story: started.body.story as string, chapter: started.body.chapter as string };
}
beforeAll(async () => { database = await openTestDb(); png = `data:image/png;base64,${(await sharp({ create: { width: 6, height: 6, channels: 3, background: "red" } }).png().toBuffer()).toString("base64")}`; });
beforeEach(async () => {
  await database.db.dropDatabase();
  app = assembleApplication(database.db, undefined, { StoryGeneration: new StoryGenerationConcept(undefined, new PreparedStoryGenerator()) });
  await seedCatalog(app);
  handle = handler(app);
});
afterAll(async () => { await database?.close(); });

test("save/reopen/photo removal survive reassembly with actual bytes and never complete exploration", async () => {
  const cookie = await register("alice");
  const scope = await story(cookie);
  const empty = await post("/stories/reflection/get", { story: scope.story }, cookie);
  expect(empty.status).toBe(200);
  expect(empty.body.entry).toBeNull();
  expect(empty.body.limits).toEqual({ maxImages: 3, maxImageBytes: 1048576, maxTextCharacters: 5000, acceptedMimeTypes: ["image/jpeg", "image/png", "image/webp"], requestBodyBytes: 5242880 });
  const saved = await post("/stories/reflection/save", { story: scope.story, text: "", images: [png] }, cookie);
  expect(saved.status).toBe(200);
  expect(saved.body.entry).toMatchObject({ story: scope.story, chapter: scope.chapter, text: "", images: [png] });
  const persisted = new ApplicationPersistence(database.db);
  await persisted.save(app);
  app = assembleApplication(database.db);
  expect(await persisted.restore(app)).toBe(true);
  handle = handler(app);
  const reopened = await post("/stories/reflection/get", { story: scope.story }, cookie);
  expect(reopened.body.entry).toEqual(saved.body.entry);
  const replaced = await post("/stories/reflection/save", { story: scope.story, text: "  I made something.  ", images: [] }, cookie);
  expect(replaced.status).toBe(200);
  expect(replaced.body.entry).toMatchObject({ page: saved.body.entry.page, text: "I made something.", images: [] });
  const retry = await post("/stories/reflection/save", { story: scope.story, text: "I made something.", images: [] }, cookie);
  expect(retry.body.entry).toEqual(replaced.body.entry);
  expect(await database.db.collection("reflecting.pages").countDocuments({})).toBe(1);
  const history = await post("/explorations/history", {}, cookie);
  expect(history.body.explorations).toEqual([expect.objectContaining({ story: scope.story, status: "started" })]);
});

test("sessions and final story authorization prevent owner/chapter spoofing and reveal no absence", async () => {
  const alice = await register("alice");
  const scope = await story(alice);
  await post("/stories/reflection/save", { story: scope.story, text: "private", images: [png] }, alice);
  const bob = await register("bob");
  for (const path of ["get", "save"]) {
    const body = { story: scope.story, text: "overwrite", images: [], user: "alice", chapter: scope.chapter, session: alice.split("=")[1] };
    const foreign = await post(`/stories/reflection/${path}`, body, bob);
    const missing = await post(`/stories/reflection/${path}`, { ...body, story: "missing" }, bob);
    expect(foreign.status).toBe(404);
    expect(foreign.body).toEqual(missing.body);
    const unauthenticated = await post(`/stories/reflection/${path}`, body);
    expect(unauthenticated.status).toBe(401);
    const expired = await post(`/stories/reflection/${path}`, body, "ask-jordan-session=expired");
    expect(expired.status).toBe(401);
  }
  const unfinished = await story(bob, false);
  expect((await post("/stories/reflection/get", { story: unfinished.story }, bob)).status).toBe(400);
  expect((await post("/stories/reflection/save", { story: unfinished.story, text: "premature", images: [] }, bob)).status).toBe(400);
  expect((await post("/stories/reflection/get", { story: scope.story, chapter: "spoofed" }, alice)).body.entry).toMatchObject({ chapter: scope.chapter, text: "private" });
});

test("malformed input and invalid/oversized uploads fail before replacing work", async () => {
  const cookie = await register("alice");
  const scope = await story(cookie);
  await post("/stories/reflection/save", { story: scope.story, text: "original", images: [png] }, cookie);
  for (const values of [
    { story: null, text: "valid", images: [] }, { story: "", text: "valid", images: [] },
    { text: null, images: [] }, { text: "valid", images: [5] }, { text: "valid", images: {} },
    { text: "", images: [] }, { text: "x".repeat(5001), images: [] },
    { text: "valid", images: [png, png, png, png] }, { text: "valid", images: [png.replace("image/png", "image/jpeg")] },
    { text: "valid", images: [`data:image/png;base64,${Buffer.alloc(1048577).toString("base64")}`] },
    { text: "valid", images: ["https://example.com/image.png"] },
  ]) {
    const result = await post("/stories/reflection/save", { story: scope.story, ...values }, cookie);
    expect(result.status).toBe(400);
    expect(result.body.error).toBe("INVALID_REQUEST");
  }
  const tooLarge = await post("/stories/reflection/save", { story: scope.story, text: "x".repeat(5242880), images: [] }, cookie);
  expect(tooLarge.status).toBe(400);
  expect(tooLarge.body).toEqual({ error: "INVALID_REQUEST" });
  const restored = await post("/stories/reflection/get", { story: scope.story }, cookie);
  expect(restored.body.entry).toMatchObject({ text: "original", images: [png] });
});

test("missing durable store returns opaque internal failure, and work remains recoverable", async () => {
  const cookie = await register("alice");
  const scope = await story(cookie);
  await post("/stories/reflection/save", { story: scope.story, text: "saved", images: [png] }, cookie);
  const persistence = new ApplicationPersistence(database.db);
  await persistence.save(app);
  const closedClient = new MongoClient(process.env.MONGODB_URL!);
  const closedDb = closedClient.db(database.db.databaseName);
  await closedClient.close();
  app = assembleApplication(database.db, undefined, { Reflecting: new ReflectingConcept(closedDb) });
  await persistence.restore(app);
  handle = handler(app);
  for (const path of ["get", "save"]) {
    const result = await post(`/stories/reflection/${path}`, { story: scope.story, text: "failed edit", images: [] }, cookie);
    expect(result.status).toBe(500);
    expect(result.body).toEqual({ error: "INTERNAL_ERROR" });
  }
  app = assembleApplication(database.db);
  await persistence.restore(app);
  handle = handler(app);
  expect((await post("/stories/reflection/get", { story: scope.story }, cookie)).body.entry).toMatchObject({ text: "saved", images: [png] });
});


test("valid photo payloads above the former 1 MiB body limit save and recover exact bytes", async () => {
  const cookie = await register("alice");
  const scope = await story(cookie);
  const original = Buffer.from(png.split(",")[1]!, "base64");
  const metadata = Buffer.concat([Buffer.from("note\0"), Buffer.alloc(600_000, 65)]);
  const padded = insertBeforePngEnd(original, pngChunk("tEXt", metadata));
  const image = `data:image/png;base64,${padded.toString("base64")}`;
  const body = { story: scope.story, text: "photos", images: [image, image, image] };
  expect(Buffer.byteLength(JSON.stringify(body))).toBeGreaterThan(1_048_576);
  expect(Buffer.byteLength(JSON.stringify(body))).toBeLessThan(5_242_880);
  const saved = await post("/stories/reflection/save", body, cookie);
  expect(saved.status).toBe(200);
  expect(saved.body.entry.images).toEqual(body.images);
  const stored = await database.db.collection("reflecting.pages").findOne({ story: scope.story });
  expect(stored?.images).toEqual(body.images);
});

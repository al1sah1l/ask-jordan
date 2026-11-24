import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { assembleApplication, getPersistenceConcepts } from "../src/assembly.ts";
import { createAccountDeletionHandler } from "../src/accountDeletionHttp.ts";
import { AuthenticatingConcept } from "../src/concepts/Authenticating.ts";
import { AccountConcept } from "../src/concepts/Account.ts";
import { SessioningConcept, UnknownSession } from "../src/concepts/Sessioning.ts";
import { InterestGenerationConcept } from "../src/concepts/InterestGeneration.ts";
import { ApplicationPersistence } from "../src/persistence.ts";
import { EXPORT_STATE, RESTORE_STATE } from "../src/persistence-symbols.ts";
import { createProgressiveChapter } from "../src/learning/ProgressiveChapter.ts";
import { seedCatalog } from "../src/catalog.ts";
import { openTestDb, type TestDb } from "./test-db.ts";

const ORIGIN = "http://127.0.0.1:8080";
const PASSWORD = "DeletionTest123!";
const users = ["alpha", "beta"];
let database: TestDb;
let application: ReturnType<typeof assembleApplication>;
let persistence: ApplicationPersistence;
let sessions: Record<string, string[]>;
let handle: ReturnType<typeof createAccountDeletionHandler>;

beforeAll(async () => { database = await openTestDb(); });
afterAll(async () => { await database?.close(); });
beforeEach(async () => {
  await database.db.dropDatabase();
  application = assembleApplication(database.db, undefined, {
    InterestGeneration: new InterestGenerationConcept(undefined, {
      async recommendActivities(input) { return input.candidates.slice(0, input.limit).map(item => item.activity); },
    }),
  });
  persistence = new ApplicationPersistence(database.db);
  const catalog = await seedCatalog(application);
  const concepts = getPersistenceConcepts(application);
  const activity = catalog.activities[0]!.activity;
  const secondActivity = catalog.activities[1]!.activity;
  sessions = {};
  for (const user of users) {
    await new AuthenticatingConcept(database.db).register({ username: user, password: PASSWORD });
    await new AccountConcept(database.db).createAccount({ user, name: user, about: `${user}'s private profile` });
    sessions[user] = [
      (await new SessioningConcept(database.db).start({ user })).session,
      (await new SessioningConcept(database.db).start({ user })).session,
    ];
    concepts.interests.setPreference({ user, subject: activity, status: "interested" });
    concepts.explorations.startExploration({ user, story: `${user}-legacy` });
    await concepts.suggestions.generateSuggestions({
      user, preferences: [], activities: concepts.interests._activities({}),
      connections: [], startedActivities: [],
    });
    for (const collection of ["reflecting.pages", "reflecting.journals", "avatarcustomizing.holdings", "avatarcustomizing.worn"]) {
      await database.db.collection(collection).insertOne({ user, text: `${user}'s private content`, images: ["private-photo"] });
    }
  }
  concepts.stories[RESTORE_STATE]({
    stories: users.map(user => ({ story: `${user}-legacy`, user, activity, context: `${user}'s context`, chapters: [`${user}-chapter`] })),
    chapters: users.map(user => ({ story: `${user}-legacy`, chapter: `${user}-chapter`, position: 1, text: `${user}'s narrative`, question: "What next?" })),
    progressive: { stories: users.map(user => ({
      story: `${user}-progressive`, user, activity: secondActivity, context: `${user}'s progressive context`,
      chapters: [createProgressiveChapter({
        story: `${user}-progressive`, chapter: `${user}-progressive-chapter`, position: 1,
        theory: { topic: "Camera shots", explanation: "A wide shot shows the scene.", keyTerms: ["wide shot"] },
        introduction: `${user}'s introduction`, firstQuestion: { prompt: "What next?" },
      })],
    })) },
  });
  await persistence.save(application);
  handle = createAccountDeletionHandler(application, database.db, persistence);
});

function request(body: unknown = { confirmation: "alpha", password: PASSWORD }, options: { origin?: string; session?: string | null; method?: string; raw?: string } = {}) {
  const headers: Record<string, string> = { Origin: options.origin ?? ORIGIN, "Content-Type": "application/json" };
  const session = options.session === undefined ? sessions.alpha![0] : options.session;
  if (session) headers.Cookie = `__Host-ask-jordan-session=${session}`;
  const method = options.method ?? "POST";
  return new Request(`${ORIGIN}/api/account/delete`, {
    method, headers, ...(method === "POST" ? { body: options.raw ?? JSON.stringify(body) } : {}),
  });
}

test("deletion removes all owned data, survives restart, and leaves another account intact", async () => {
  const response = await handle(request({ confirmation: "alpha", password: PASSWORD, user: "beta" }));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ deleted: true });
  expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  for (const collection of ["reflecting.pages", "reflecting.journals", "avatarcustomizing.holdings", "avatarcustomizing.worn", "sessioning.sessions"]) {
    expect(await database.db.collection(collection).countDocuments({ user: "alpha" })).toBe(0);
    expect(await database.db.collection(collection).countDocuments({ user: "beta" })).toBeGreaterThan(0);
  }
  for (const collection of ["authenticating.accounts", "account.profiles"]) {
    expect(await database.db.collection<{ _id: string }>(collection).countDocuments({ _id: "alpha" })).toBe(0);
    expect(await database.db.collection<{ _id: string }>(collection).countDocuments({ _id: "beta" })).toBe(1);
  }
  for (const session of sessions.alpha!) {
    await expect(new SessioningConcept(database.db).current({ session })).rejects.toBeInstanceOf(UnknownSession);
  }
  expect(await new SessioningConcept(database.db).current({ session: sessions.beta![0]! })).toEqual({ user: "beta" });
  const live = getPersistenceConcepts(application);
  expect(live.suggestions._getSuggestions({ user: "alpha" })).toEqual([]);
  expect(live.suggestions._getSuggestions({ user: "beta" }).length).toBeGreaterThan(0);

  const restarted = assembleApplication(database.db);
  expect(await persistence.restore(restarted)).toBe(true);
  const restored = getPersistenceConcepts(restarted);
  const state = restored.stories[EXPORT_STATE]();
  expect(state.stories.map(row => row.user)).toEqual(["beta"]);
  expect(state.chapters.map(row => row.chapter)).toEqual(["beta-chapter"]);
  expect(state.progressive!.stories.map(row => row.user)).toEqual(["beta"]);
  expect(restored.interests[EXPORT_STATE]().preferences.map(row => row.user)).toEqual(["beta"]);
  expect(restored.explorations[EXPORT_STATE]().explorations.map(row => row.user)).toEqual(["beta"]);
  expect(restored.interests._activities({}).length).toBe(8);
  await new AuthenticatingConcept(database.db).register({ username: "alpha", password: PASSWORD });
  expect((await handle(request())).status).toBe(401);
});

test("wrong password and missing confirmation preserve the account and session", async () => {
  for (const [body, code] of [
    [{ confirmation: "alpha", password: "wrong-password" }, "DELETE_PASSWORD_INCORRECT"],
    [{ confirmation: "beta", password: PASSWORD }, "DELETE_CONFIRMATION_REQUIRED"],
    [{ confirmation: "alpha" }, "DELETE_PASSWORD_REQUIRED"],
  ] as const) {
    const response = await handle(request(body));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: code });
    expect(response.headers.get("set-cookie")).toBeNull();
  }
  expect(await database.db.collection("account.profiles").countDocuments()).toBe(2);
  expect(await new SessioningConcept(database.db).current({ session: sessions.alpha![0]! })).toEqual({ user: "alpha" });
});

test("a session cookie and matching origin are required; caller-supplied sessions cannot authorize deletion", async () => {
  expect((await handle(request({ password: PASSWORD, confirmation: "alpha", session: sessions.alpha![0] }, { session: null }))).status).toBe(401);
  expect((await handle(request(undefined, { session: "invalid-session" }))).status).toBe(401);
  expect((await handle(request(undefined, { origin: "http://evil.example" }))).status).toBe(403);
  expect((await handle(request(undefined, { method: "GET" }))).status).toBe(405);
  expect(await database.db.collection("account.profiles").countDocuments()).toBe(2);
});

test("malformed and oversized bodies are refused without deleting anything", async () => {
  for (const raw of ["{", "[]", JSON.stringify({ confirmation: "alpha", password: PASSWORD, padding: "x".repeat(5000) })]) {
    expect((await handle(request(undefined, { raw }))).status).toBe(400);
  }
  expect(await database.db.collection("account.profiles").countDocuments()).toBe(2);
});

test("storage failure never claims success or removes credentials needed to retry", async () => {
  class UnavailablePersistence extends ApplicationPersistence {
    override async removeUser() { throw new Error("unavailable"); }
  }
  const failing = createAccountDeletionHandler(application, database.db, new UnavailablePersistence(database.db));
  const response = await failing(request());
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "ACCOUNT_DELETION_UNAVAILABLE" });
  expect(await new AuthenticatingConcept(database.db).authenticate({ username: "alpha", password: PASSWORD })).toEqual({ account: "alpha" });
  expect(await new SessioningConcept(database.db).current({ session: sessions.alpha![0]! })).toEqual({ user: "alpha" });
});

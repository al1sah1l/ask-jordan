
import {
  afterAll,
  beforeAll,
  expect,
  test,
} from "bun:test";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { TestDb } from "./test-db.ts";
// Load the MongoDB URL before importing assembly.
if (!process.env.MONGODB_URL) {
  const env = readFileSync(
    join(import.meta.dir, "../.env"),
    "utf8",
  );

  const url = env.match(/^MONGODB_URL=(.*)$/m)?.[1]?.trim();

  if (url) process.env.MONGODB_URL = url;
}

const { createGateway } = await import(
  "@mit-sdg/sync-engine/boundary"
);

const { createHttpHandler } = await import(
  "@mit-sdg/sync-engine-http/handler"
);

const { assembleApplication } = await import(
  "../src/assembly.ts"
);

const { seedCatalog } = await import("../src/catalog.ts");
const { policy } = await import("../src/http.ts");
const { openTestDb } = await import("./test-db.ts");
const { ApplicationPersistence } = await import("../src/persistence.ts");

function preparedApplication(database: TestDb["db"]) {
  const previous = process.env.STORY_GENERATION_MODE;
  process.env.STORY_GENERATION_MODE = "prepared";
  try { return assembleApplication(database); }
  finally {
    if (previous === undefined) delete process.env.STORY_GENERATION_MODE;
    else process.env.STORY_GENERATION_MODE = previous;
  }
}

let testDb: TestDb;

beforeAll(async () => {
  testDb = await openTestDb();
});

afterAll(async () => {
  await testDb?.close();
});

test("Alpha journey: registration through exploration", async () => {
  await testDb.db.dropDatabase();

  const app = preparedApplication(testDb.db);

  const catalog = await seedCatalog(app);

  let handler = createHttpHandler({
    application: app,
    gateway: createGateway({ application: app }),
    policy,
  });

  async function post(
    path: string,
    body: Record<string, unknown> = {},
    cookie?: string,
  ) {
    const headers: Record<string, string> = {
      Origin: "http://127.0.0.1:8080",
      "Content-Type": "application/json",
    };

    if (cookie) headers.Cookie = cookie;

    const response = await handler(
      new Request(`http://127.0.0.1:3000/api${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      }),
    );

    return {
      status: response.status,
      body: await response.json() as Record<string, any>,
      cookie: response.headers.get("set-cookie"),
    };
  }

  // 1. Register
  const registered = await post("/auth/register", {
    username: "george",
    email: "george@example.com",
    password: "secure-password-123",
  });

  expect(registered.status).toBe(200);
  expect(registered.body.account).toBe("george");

  const cookie = registered.cookie!.split(";")[0]!;

  // 2. Create the profile through the authenticated boundary.
  const missing = await post("/account/profile", {}, cookie);
  expect(missing.status).toBe(404);
  const profile = await post("/account/create", {
    name: "George", about: "I love soccer and watching movies.",
  }, cookie);
  expect(profile.status).toBe(200);

  // 3. Retrieve catalog.
  const activities = await post(
    "/interests/activities",
    {},
    cookie,
  );

  expect(activities.status).toBe(200);
  expect(activities.body.activities).toHaveLength(8);

  // 4. Choose Sports Photography.
  const photography = catalog.activities.find(
    (activity) => activity.name === "Sports Photography",
  );

  expect(photography).toBeDefined();

  const preference = await post(
    "/interests/preference",
    {
      subject: photography!.activity,
      status: "interested",
    },
    cookie,
  );

  expect(preference.status).toBe(200);

  // 5. Start a personalized story.
  const started = await post(
    "/stories/start",
    { activity: photography!.activity },
    cookie,
  );

  expect(started.status).toBe(200);

  const story = started.body.story as string;

  expect(typeof story).toBe("string");

  // 6. Verify first chapter.
  const first = await post(
    "/stories/get",
    { story },
    cookie,
  );

  expect(first.status).toBe(200);
  expect(first.body.chapters).toHaveLength(1);
  expect(first.body.chapters[0].position).toBe(1);
  expect(first.body.chapters[0].text).toContain("I love soccer and watching movies.");
  expect(first.body.chapters[0].text).toContain("Jordan");
  expect(first.body.chapters[0].text).not.toContain("?");
  expect(first.body.chapters[0].question).toContain("?");

  // New context affects new adventures, never an existing story snapshot.
  expect((await post("/account/update", {
    name: "George B", about: "I have paper and enjoy maps.",
  }, cookie)).status).toBe(200);
  const writing = catalog.activities.find((a) => a.name === "Creative Writing")!;
  const newStory = await post("/stories/start", { activity: writing.activity }, cookie);
  const updatedContext = await post("/stories/get", { story: newStory.body.story }, cookie);
  expect(updatedContext.body.chapters[0].text).toContain("I have paper and enjoy maps.");
  const original = await post("/stories/get", { story }, cookie);
  expect(original.body.chapters[0].text).toBe(first.body.chapters[0].text);

  // 7. Story automatically starts exploration.
  const exploration = await post(
    "/explorations/history",
    {},
    cookie,
  );

  expect(exploration.status).toBe(200);
  expect(exploration.body.explorations).toEqual(expect.arrayContaining([
    expect.objectContaining({
      story,
      status: "started",
    }),
  ]));

  // 8. Continue the story.
  const continued = await post(
    "/stories/continue",
    {
      story,
      answer: "I would photograph the players.",
    },
    cookie,
  );

  expect(continued.status).toBe(200);

  const second = await post(
    "/stories/get",
    { story },
    cookie,
  );

  expect(second.body.chapters).toHaveLength(2);
  expect(second.body.chapters[1].position).toBe(2);
  expect(second.body.chapters[0].answer).toBe("I would photograph the players.");
  expect(second.body.chapters[1].text).toContain("follows a player");
  expect(second.body.chapters[1].question).toBeTruthy();

  // 9. Continue to the final chapter.
  const final = await post(
    "/stories/continue",
    {
      story,
      answer: "I want to capture movement.",
    },
    cookie,
  );

  expect(final.status).toBe(200);

  const completedStory = await post(
    "/stories/get",
    { story },
    cookie,
  );

  expect(completedStory.body.chapters).toHaveLength(3);

  expect(
    completedStory.body.chapters[2].suggestedActivity,
  ).toBeTruthy();

  // 10. Exploration remains started until explicitly completed.
  const history = await post(
    "/explorations/history",
    {},
    cookie,
  );

  expect(history.body.explorations[0].status).toBe("started");

  expect(completedStory.body.chapters[1].answer).toBe("I want to capture movement.");
  expect(completedStory.body.chapters[2].question).toBeUndefined();
  expect(completedStory.body.chapters[2].suggestedActivity).toContain("10 minutes");

  const persistence = new ApplicationPersistence(testDb.db);
  await persistence.save(app);
  const restored = preparedApplication(testDb.db);
  expect(await persistence.restore(restored)).toBe(true);
  await seedCatalog(restored);
  handler = createHttpHandler({ application: restored, gateway: createGateway({ application: restored }), policy });
  const reopened = await post("/stories/get", { story }, cookie);
  expect(reopened.body).toEqual(completedStory.body);
  const list = await post("/stories/list", {}, cookie);
  expect(list.body.stories.filter((s: { activity: string }) => s.activity === photography!.activity)).toEqual([
    expect.objectContaining({ story }),
  ]);
  expect((await post("/stories/start", { activity: photography!.activity }, cookie)).status).not.toBe(200);
  expect((await post("/explorations/history", {}, cookie)).body.explorations.every((e: { status: string }) => e.status === "started")).toBe(true);
});

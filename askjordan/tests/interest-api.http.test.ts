
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";

import { readFileSync } from "node:fs";
import { join } from "node:path";

// Resolve MongoDB configuration before importing assembly.
if (!process.env.MONGODB_URL) {
  const envFile = readFileSync(
    join(import.meta.dir, "../.env"),
    "utf8",
  );

  const value = envFile
    .match(/^MONGODB_URL=(.*)$/m)?.[1]?.trim();

  if (value) process.env.MONGODB_URL = value;
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

const { StoryGenerationConcept } = await import(
  "../src/concepts/StoryGeneration.ts"
);

const { seedCatalog } = await import(
  "../src/catalog.ts"
);

const { policy } = await import("../src/http.ts");

const { openTestDb } = await import("./test-db.ts");

import type { TestDb } from "./test-db.ts";

import type {
  StoryGenerator,
  StoryChapterContext,
  GeneratedStoryChapter,
} from "../src/ai/StoryGenerator.ts";

const ORIGIN = "http://127.0.0.1:8080";
const PASSWORD = "test-password-123";

class MockStoryGenerator implements StoryGenerator {
  async generateChapter(
    input: StoryChapterContext,
  ): Promise<GeneratedStoryChapter> {
    return {
      text: `Chapter ${input.position}: ${input.activity}`,
      question:
        input.position < 3
          ? "What would you explore next?"
          : undefined,
      suggestedActivity:
        input.position === 3
          ? "Try the activity for ten minutes."
          : undefined,
    };
  }
}

let testDb: TestDb;

let app: ReturnType<typeof assembleApplication>;

let handle: ReturnType<typeof createHttpHandler>;

async function post(
  path: string,
  body: Record<string, unknown> = {},
  cookie?: string,
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Origin: ORIGIN,
  };

  if (cookie) {
    headers.Cookie = cookie;
  }

  const response = await handle(
    new Request(
      `http://127.0.0.1:3000/api${path}`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      },
    ),
  );

  return {
    status: response.status,
    body: await response.json() as Record<string, any>,
    setCookie: response.headers.get("set-cookie"),
  };
}

function requireString(
  record: Record<string, any>,
  field: string,
): string {
  const value: unknown = record[field];

  if (typeof value !== "string") {
    throw new Error(
      `Expected "${field}" in ${JSON.stringify(record)}`,
    );
  }

  return value;
}

async function registerUser(username: string) {
  const result = await post("/auth/register", {
    username,
    password: PASSWORD,
  });

  expect(result.status).toBe(200);
  expect(result.setCookie).toContain(
    "ask-jordan-session=",
  );

  const cookie = result.setCookie!.split(";")[0]!;

  return cookie;
}

function findActivity(
  activities: Array<{
    activity: string;
    name: string;
  }>,
  name: string,
): string {
  const activity = activities.find(
    (item) => item.name === name,
  );

  if (!activity) {
    throw new Error(`Missing catalog activity: ${name}`);
  }

  return activity.activity;
}

beforeAll(async () => {
  testDb = await openTestDb();
});

beforeEach(async () => {
  await testDb.db.dropDatabase();

  app = assembleApplication(
    testDb.db,
    undefined,
    {
      StoryGeneration: new StoryGenerationConcept(
        () => crypto.randomUUID(),
        new MockStoryGenerator(),
      ),
    },
  );

  await seedCatalog(app);

  handle = createHttpHandler({
    application: app,
    gateway: createGateway({ application: app }),
    policy,
  });
});

afterAll(async () => {
  await testDb?.close();
});

describe("Interest API over HTTP", () => {
  test("authenticated user can browse the catalog", async () => {
    const cookie = await registerUser("george");

    const topics = await post(
      "/interests/topics",
      {},
      cookie,
    );

    const activities = await post(
      "/interests/activities",
      {},
      cookie,
    );

    expect(topics.status).toBe(200);
    expect(activities.status).toBe(200);

    expect(topics.body.topics).toHaveLength(3);
    expect(activities.body.activities).toHaveLength(8);

    expect(
      activities.body.activities.some(
        (item: { name: string }) =>
          item.name === "Sports Photography",
      ),
    ).toBe(true);
  });

  test("user can save and retrieve their preferences", async () => {
    const cookie = await registerUser("george");

    const catalog = await post(
      "/interests/activities",
      {},
      cookie,
    );

    const activity = findActivity(
      catalog.body.activities,
      "Sports Photography",
    );

    const saved = await post(
      "/interests/preference",
      {
        subject: activity,
        status: "interested",
      },
      cookie,
    );

    expect(saved.status).toBe(200);
    expect(saved.body.preference).toBeString();

    const preferences = await post(
      "/interests/preferences",
      {},
      cookie,
    );

    expect(preferences.status).toBe(200);

    expect(preferences.body.preferences).toEqual([
      expect.objectContaining({
        subject: activity,
        status: "interested",
      }),
    ]);
  });

  test("preferences are isolated between users", async () => {
    const georgeCookie = await registerUser("george");
    const sarahCookie = await registerUser("sarah");

    const catalog = await post(
      "/interests/activities",
      {},
      georgeCookie,
    );

    const activity = findActivity(
      catalog.body.activities,
      "Sports Photography",
    );

    await post(
      "/interests/preference",
      {
        subject: activity,
        status: "curious",
      },
      georgeCookie,
    );

    const georgePreferences = await post(
      "/interests/preferences",
      {},
      georgeCookie,
    );

    const sarahPreferences = await post(
      "/interests/preferences",
      {},
      sarahCookie,
    );

    expect(georgePreferences.body.preferences).toHaveLength(1);
    expect(sarahPreferences.body.preferences).toHaveLength(0);
  });

  test("starting a story creates an exploration", async () => {
    const cookie = await registerUser("george");

    // Profile endpoint belongs to the Account integration.
    // Create it directly here to isolate the Story API.
    await app.concepts.Account.createAccount({
      user: "george",
      name: "George",
      about: "I enjoy soccer and movies.",
    });

    const catalog = await post(
      "/interests/activities",
      {},
      cookie,
    );

    const activity = findActivity(
      catalog.body.activities,
      "Sports Photography",
    );

    const started = await post(
      "/stories/start",
      { activity },
      cookie,
    );

    expect(started.status).toBe(200);

    const story = requireString(
      started.body,
      "story",
    );

    expect(started.body.chapter).toBeString();

    const loaded = await post(
      "/stories/get",
      { story },
      cookie,
    );

    expect(loaded.status).toBe(200);
    expect(loaded.body.chapters).toHaveLength(1);

    const history = await post(
      "/explorations/history",
      {},
      cookie,
    );

    expect(history.status).toBe(200);

    expect(history.body.explorations).toEqual([
      expect.objectContaining({
        story,
        status: "started",
      }),
    ]);
  });

  test("one user cannot read another user's story", async () => {
    const georgeCookie = await registerUser("george");
    const sarahCookie = await registerUser("sarah");

    await app.concepts.Account.createAccount({
      user: "george",
      name: "George",
      about: "I like soccer.",
    });

    const catalog = await post(
      "/interests/activities",
      {},
      georgeCookie,
    );

    const activity = findActivity(
      catalog.body.activities,
      "Sports Photography",
    );

    const started = await post(
      "/stories/start",
      { activity },
      georgeCookie,
    );

    expect(started.status).toBe(200);

    const story = requireString(
      started.body,
      "story",
    );

    const denied = await post(
      "/stories/get",
      { story },
      sarahCookie,
    );

    expect(denied.status).not.toBe(200);
    expect(denied.body).toHaveProperty("error");
  });
});


test("rejects requests without a session cookie", async () => {
  const result = await post("/interests/activities");

  expect(result.status).toBe(401);
  expect(result.body).toEqual({
    error: "UNAUTHORIZED",
  });
});

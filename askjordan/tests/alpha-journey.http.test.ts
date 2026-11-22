
import {
  afterAll,
  beforeAll,
  expect,
  test,
} from "bun:test";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { TestDb } from "./test-db.ts";
import type {
  StoryGenerator,
  StoryChapterContext,
  GeneratedStoryChapter,
} from "../src/ai/StoryGenerator.ts";

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

const { StoryGenerationConcept } = await import(
  "../src/concepts/StoryGeneration.ts"
);

const { seedCatalog } = await import("../src/catalog.ts");
const { policy } = await import("../src/http.ts");
const { openTestDb } = await import("./test-db.ts");

class PreparedStoryGenerator implements StoryGenerator {
  async generateChapter(
    input: StoryChapterContext,
  ): Promise<GeneratedStoryChapter> {
    if (input.position === 1) {
      return {
        text: "George discovers sports photography at a soccer game.",
        question: "Would you photograph the players or the crowd?",
      };
    }

    if (input.position === 2) {
      return {
        text: "George experiments with capturing movement.",
        question: "What would you like to capture next?",
      };
    }

    return {
      text: "George discovers that photography can tell stories.",
      suggestedActivity: "Take three action photos with your phone.",
    };
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

  const app = assembleApplication(
    testDb.db,
    undefined,
    {
      StoryGeneration: new StoryGenerationConcept(
        () => crypto.randomUUID(),
        new PreparedStoryGenerator(),
      ),
    },
  );

  const catalog = await seedCatalog(app);

  const handler = createHttpHandler({
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
    password: "secure-password-123",
  });

  expect(registered.status).toBe(200);
  expect(registered.body.account).toBe("george");

  const cookie = registered.cookie!.split(";")[0]!;

  // 2. Create profile.
  // Temporary direct concept call until Profile API is ready.
  const profile = await app.concepts.Account.createAccount({
    user: "george",
    name: "George",
    about: "I love soccer and watching movies.",
  });

  expect(profile).toHaveProperty("profile");

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

  // 7. Story automatically starts exploration.
  const exploration = await post(
    "/explorations/history",
    {},
    cookie,
  );

  expect(exploration.status).toBe(200);
  expect(exploration.body.explorations).toEqual([
    expect.objectContaining({
      story,
      status: "started",
    }),
  ]);

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

  // TODO (Profile API): replace direct Account call with HTTP.
  // TODO (Reflecting): submit and reload a journal entry through HTTP.
  // TODO (Completion API): test explicit exploration completion.
});

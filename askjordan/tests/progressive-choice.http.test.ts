
import { expect, test } from "bun:test";
import { assembleApplication, getPersistenceConcepts } from "../src/assembly.ts";
import { AccountConcept } from "../src/concepts/Account.ts";
import { SessioningConcept } from "../src/concepts/Sessioning.ts";
import { createProgressiveHttpHandler } from "../src/learning/progressiveHttp.ts";
import { ApplicationPersistence } from "../src/persistence.ts";
import { seedCatalog } from "../src/catalog.ts";
import { openTestDb } from "./test-db.ts";
import type { ProgressiveContentGenerator } from "../src/learning/ProgressiveStoryEngine.ts";

let firstChoiceCalls = 0;
let secondChoiceCalls = 0;

const generator: ProgressiveContentGenerator = {
  async beginChapter() {
    return {
      theory: {
        topic: "Camera shots",
        explanation: "A close-up focuses on details.",
        keyTerms: ["close-up", "wide shot"],
      },
      introduction: "Alex and Jordan begin filming.",
      firstQuestion: {
        prompt: "Which shot should Alex use?",
        options: ["Close-up", "Wide shot"],
      },
    };
  },

  async afterFirstChoice({ answer }) {
    firstChoiceCalls++;

    return {
      scene: `Alex chooses ${answer} and films the scene.`,
      question: {
        prompt: "How should Alex improve the scene?",
        options: ["Change angle", "Change lighting"],
      },
    };
  },

  async afterSecondChoice({ answer }) {
    secondChoiceCalls++;

    return {
      conclusion: `Alex decides to ${answer.toLowerCase()} and finishes filming.`,
      practicalChallenge: "Record a short scene using two camera angles.",
    };
  },
};

test("progressive choices are validated, authorized and persisted", async () => {
  const database = await openTestDb();
  firstChoiceCalls = 0;
  secondChoiceCalls = 0;

  try {
    const app = assembleApplication(database.db, undefined, {
      ProgressiveContentGenerator: generator,
    });

    const catalog = await seedCatalog(app);
    const activity = catalog.activities[0]!.activity;

    const accounts = new AccountConcept(database.db);
    await accounts.createAccount({ user: "george", name: "George", about: "Likes movies." });

    const sessions = new SessioningConcept(database.db);
    const george = await sessions.start({ user: "george" });
    const sarah = await sessions.start({ user: "sarah" });

    const persistence = new ApplicationPersistence(database.db);
    const handle = createProgressiveHttpHandler(app, database.db, persistence);

    function request(
      endpoint: "start" | "choice" | "get",
      body: Record<string, unknown>,
      cookie?: string,
    ): Request {
      return new Request(
        `http://127.0.0.1:3000/api/stories/progressive/${endpoint}`,
        {
          method: "POST",
          headers: {
            Origin: "http://127.0.0.1:8080",
            "Content-Type": "application/json",
            ...(cookie ? { Cookie: `__Host-ask-jordan-session=${cookie}` } : {}),
          },
          body: JSON.stringify(body),
        },
      );
    }

    // Start a progressive story.
    const startedResponse = await handle(request("start", { activity }, george.session));
    expect(startedResponse.status).toBe(200);

    const started = await startedResponse.json() as { story: string; chapter: string };
    const story = started.story;
    const chapter = started.chapter;

    // Missing session.
    const anonymous = await handle(request("choice", {
      story, chapter, answer: "Close-up", expectedStage: "first-choice",
    }));
    expect(anonymous.status).toBe(401);

    // Another user cannot modify George's story.
    const foreign = await handle(request("choice", {
      story, chapter, answer: "Close-up", expectedStage: "first-choice",
    }, sarah.session));
    expect(foreign.status).toBe(404);

    // Invalid answer must not call the AI generator.
    const invalid = await handle(request("choice", {
      story, chapter, answer: "Something else", expectedStage: "first-choice",
    }, george.session));

    expect(invalid.status).toBe(400);
    expect(firstChoiceCalls).toBe(0);

    // Submit the first choice.
    const first = await handle(request("choice", {
      story, chapter, answer: "Close-up", expectedStage: "first-choice",
    }, george.session));

    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({
      story, chapter, stage: "second-choice",
    });
    expect(firstChoiceCalls).toBe(1);

    // A repeated request cannot generate the next scene again.
    const duplicate = await handle(request("choice", {
      story, chapter, answer: "Close-up", expectedStage: "first-choice",
    }, george.session));

    expect(duplicate.status).toBe(409);
    expect(firstChoiceCalls).toBe(1);

    // Submit the second choice.
    const second = await handle(request("choice", {
      story, chapter, answer: "Change angle", expectedStage: "second-choice",
    }, george.session));

    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({
      story, chapter, stage: "awaiting-reflection",
    });
    expect(secondChoiceCalls).toBe(1);

    // Verify the chapter remains the same.
    const read = await handle(request("get", { story }, george.session));
    expect(read.status).toBe(200);

    const visible = await read.json() as {
      chapters: Array<{
        chapter: string;
        stage: string;
        firstDecision?: { answer: string };
        secondDecision?: { answer: string };
        secondScene?: string;
        practicalChallenge?: string;
      }>;
    };

    expect(visible.chapters).toHaveLength(1);
    expect(visible.chapters[0]?.chapter).toBe(chapter);
    expect(visible.chapters[0]?.firstDecision?.answer).toBe("Close-up");
    expect(visible.chapters[0]?.secondDecision?.answer).toBe("Change angle");
    expect(visible.chapters[0]?.stage).toBe("awaiting-reflection");
    expect(visible.chapters[0]?.practicalChallenge).toContain("Record");

    // Simulate a backend restart and reload the MongoDB snapshot.
    const restarted = assembleApplication(database.db, undefined, {
      ProgressiveContentGenerator: generator,
    });

    expect(await persistence.restore(restarted)).toBe(true);

    const restored = getPersistenceConcepts(restarted).progressive.getStory({
      user: "george",
      story,
    });

    expect(restored.chapters).toHaveLength(1);
    expect(restored.chapters[0]?.chapter).toBe(chapter);
    expect(restored.chapters[0]?.stage).toBe("awaiting-reflection");
    expect(restored.chapters[0]?.firstDecision?.answer).toBe("Close-up");
    expect(restored.chapters[0]?.secondDecision?.answer).toBe("Change angle");
  } finally {
    await database.close();
  }
});


import { expect, test } from "bun:test";
import { assembleApplication, getPersistenceConcepts } from "../src/assembly.ts";
import { AccountConcept } from "../src/concepts/Account.ts";
import { SessioningConcept } from "../src/concepts/Sessioning.ts";
import { createProgressiveHttpHandler } from "../src/learning/progressiveHttp.ts";
import { ApplicationPersistence } from "../src/persistence.ts";
import { seedCatalog } from "../src/catalog.ts";
import { openTestDb } from "./test-db.ts";
import type { ProgressiveContentGenerator } from "../src/learning/ProgressiveStoryEngine.ts";

const generator: ProgressiveContentGenerator = {
  async beginChapter({ position }) {
    return {
      theory: {
        topic: position === 1 ? "Camera shots" : "Visual composition",
        explanation: "Every camera decision communicates information.",
        keyTerms: ["wide shot", "close-up"],
      },
      introduction: `Alex and Jordan begin chapter ${position}.`,
      firstQuestion: {
        prompt: "Which shot would you choose?",
        options: ["Close-up", "Wide shot"],
      },
    };
  },

  async afterFirstChoice({ answer }) {
    return {
      scene: `Alex chooses ${answer}.`,
      question: {
        prompt: "What should Alex do next?",
        options: ["Change angle", "Change lighting"],
      },
    };
  },

  async afterSecondChoice({ answer }) {
    return {
      conclusion: `Alex decides to ${answer.toLowerCase()}.`,
      practicalChallenge: "Film a short scene using two different shots.",
    };
  },
};

test("reflection unlocks the next chapter and survives restart", async () => {
  const database = await openTestDb();

  try {
    const app = assembleApplication(database.db, undefined, {
      ProgressiveContentGenerator: generator,
    });

    const catalog = await seedCatalog(app);
    const activity = catalog.activities[0]!.activity;

    const accounts = new AccountConcept(database.db);
    await accounts.createAccount({
      user: "george", name: "George", about: "I enjoy movies.",
    });

    const sessions = new SessioningConcept(database.db);
    const george = await sessions.start({ user: "george" });
    const sarah = await sessions.start({ user: "sarah" });

    const persistence = new ApplicationPersistence(database.db);
    const handle = createProgressiveHttpHandler(app, database.db, persistence);

    function request(
      endpoint: string,
      body: Record<string, unknown>,
      session?: string,
    ): Request {
      return new Request(`http://127.0.0.1:3000/api/stories/progressive/${endpoint}`, {
        method: "POST",
        headers: {
          Origin: "http://127.0.0.1:8080",
          "Content-Type": "application/json",
          ...(session ? { Cookie: `ask-jordan-session=${session}` } : {}),
        },
        body: JSON.stringify(body),
      });
    }

    async function post(endpoint: string, body: Record<string, unknown>, session = george.session) {
      const response = await handle(request(endpoint, body, session));
      return { status: response.status, body: await response.json() as Record<string, any> };
    }

    // Start Chapter 1.
    const started = await post("start", { activity });
    expect(started.status).toBe(200);

    const story = started.body.story as string;
    const chapter = started.body.chapter as string;
    const scope = { story, chapter };

    // The first choice reveals a second decision.
    const first = await post("choice", {
      ...scope, answer: "Close-up", expectedStage: "first-choice",
    });
    expect(first.status).toBe(200);
    expect(first.body.stage).toBe("second-choice");

    // The second choice reveals the practical challenge.
    const second = await post("choice", {
      ...scope, answer: "Change angle", expectedStage: "second-choice",
    });
    expect(second.status).toBe(200);
    expect(second.body.stage).toBe("awaiting-reflection");

    // Cannot skip reflection.
    const blocked = await post("next", scope);
    expect(blocked.status).toBe(409);

    // Initially, there is no saved reflection.
    const empty = await post("reflection/get", scope);
    expect(empty.status).toBe(200);
    expect(empty.body.entry).toBeNull();

    // Invalid empty reflections are rejected.
    const invalid = await post("reflection/save", {
      ...scope, text: " ", images: [],
    });
    expect(invalid.status).toBe(400);

    // Another user cannot access George's reflection.
    const foreign = await post("reflection/get", scope, sarah.session);
    expect(foreign.status).toBe(404);

    // Anonymous users cannot save anything.
    const anonymous = await handle(request("reflection/save", {
      ...scope, text: "Someone else's work", images: [],
    }));
    expect(anonymous.status).toBe(401);

    // Save the real reflection in MongoDB.
    const saved = await post("reflection/save", {
      ...scope,
      text: "I learned that close-ups emphasize emotions.",
      images: [],
    });

    expect(saved.status).toBe(200);
    expect(saved.body.stage).toBe("reflected");
    expect(saved.body.page).toBeString();

    const reopened = await post("reflection/get", scope);
    expect(reopened.status).toBe(200);
    expect(reopened.body.entry).toMatchObject({
      story, chapter, text: "I learned that close-ups emphasize emotions.",
      images: [],
    });

    // Cannot confirm the same chapter twice.
    const duplicateReflection = await post("reflection/save", {
      ...scope, text: "Another reflection", images: [],
    });
    expect(duplicateReflection.status).toBe(409);

    // Now Chapter 2 can be generated.
    const next = await post("next", scope);
    expect(next.status).toBe(200);
    expect(next.body.story).toBe(story);
    expect(next.body.position).toBe(2);
    expect(next.body.chapter).not.toBe(chapter);

    // Repeating the same transition is rejected.
    const duplicateNext = await post("next", scope);
    expect(duplicateNext.status).toBe(409);

    const visible = await post("get", { story });
    expect(visible.status).toBe(200);
    expect(visible.body.chapters).toHaveLength(2);
    expect(visible.body.chapters[0].stage).toBe("reflected");
    expect(visible.body.chapters[1].stage).toBe("first-choice");
    expect(visible.body.chapters[1].theory.topic).toBe("Visual composition");

    // Simulate restarting the backend.
    const restarted = assembleApplication(database.db, undefined, {
      ProgressiveContentGenerator: generator,
    });

    expect(await persistence.restore(restarted)).toBe(true);

    const restored = getPersistenceConcepts(restarted).progressive.getStory({
      user: "george", story,
    });

    expect(restored.chapters).toHaveLength(2);
    expect(restored.chapters[0]?.reflectionPage).toBe(saved.body.page);
    expect(restored.chapters[1]?.chapter).toBe(next.body.chapter);
    expect(restored.chapters[1]?.position).toBe(2);

    // Reflection is stored separately from the story snapshot.
    const savedPage = await database.db.collection("reflecting.pages").findOne({
      user: "george", story, chapter,
    });
    expect(savedPage?.page).toBe(saved.body.page);
  } finally {
    await database.close();
  }
});

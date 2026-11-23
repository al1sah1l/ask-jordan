
import {
  expect,
  test,
} from "bun:test";

import {
  assembleApplication,
  getPersistenceConcepts,
} from "../src/assembly.ts";

import {
  AccountConcept,
} from "../src/concepts/Account.ts";

import {
  SessioningConcept,
} from "../src/concepts/Sessioning.ts";

import {
  createProgressiveHttpHandler,
} from "../src/learning/progressiveHttp.ts";

import {
  ApplicationPersistence,
} from "../src/persistence.ts";

import {
  seedCatalog,
} from "../src/catalog.ts";

import {
  openTestDb,
} from "./test-db.ts";

import type {
  ProgressiveContentGenerator,
} from "../src/learning/ProgressiveStoryEngine.ts";

const generator: ProgressiveContentGenerator = {
  async beginChapter() {
    return {
      theory: {
        topic: "Camera shots",
        explanation:
          "A wide shot establishes the setting.",
        keyTerms: ["wide shot"],
      },

      introduction:
        "Alex and Jordan are preparing to film.",

      firstQuestion: {
        prompt:
          "Which shot would you choose?",
        options: [
          "Wide shot",
          "Close-up",
        ],
      },
    };
  },

  async afterFirstChoice() {
    return {
      scene:
        "Alex tries the selected shot.",

      question: {
        prompt: "What next?",
      },
    };
  },

  async afterSecondChoice() {
    return {
      conclusion:
        "Alex finishes filming.",

      practicalChallenge:
        "Record a short video.",
    };
  },
};

test(
  "progressive start is authenticated and durable",
  async () => {
    const database = await openTestDb();

    try {
      /*
       * Create a real application with a mock
       * progressive content generator.
       */
      const app = assembleApplication(
        database.db,
        undefined,
        {
          ProgressiveContentGenerator: generator,
        },
      );

      const catalog = await seedCatalog(app);

      const activity =
        catalog.activities[0]!.activity;

      /*
       * Create the user's saved profile.
       */
      const accounts =
        new AccountConcept(database.db);

      await accounts.createAccount({
        user: "george",
        name: "George",
        about:
          "Interested in making movies.",
      });

      /*
       * Create a real session.
       */
      const sessions =
        new SessioningConcept(database.db);

      const { session } = await sessions.start({
        user: "george",
      });

      const persistence =
        new ApplicationPersistence(database.db);

      const handle =
        createProgressiveHttpHandler(
          app,
          database.db,
          persistence,
        );

      const url =
        "http://127.0.0.1:3000/api/stories/progressive/start";

      /*
       * Helper for constructing requests.
       */
      function request(
        cookie?: string,
        selectedActivity = activity,
      ): Request {
        return new Request(url, {
          method: "POST",

          headers: {
            Origin:
              "http://127.0.0.1:8080",

            "Content-Type":
              "application/json",

            ...(cookie
              ? {
                  Cookie:
                    `__Host-ask-jordan-session=${cookie}`,
                }
              : {}),
          },

          body: JSON.stringify({
            activity: selectedActivity,
          }),
        });
      }

      /*
       * Test 1:
       * Anonymous requests are rejected.
       */
      const anonymous =
        await handle(request());

      expect(anonymous.status).toBe(401);

      /*
       * Test 2:
       * Authenticated user can start a story.
       */
      const created =
        await handle(request(session));

      expect(created.status).toBe(200);

      const result =
        await created.json() as {
          story: string;
          chapter: string;
          format: string;
        };

      expect(result.format)
        .toBe("progressive");

      expect(result.story)
        .toBeString();

      expect(result.chapter)
        .toBeString();

      /*
       * Test 3:
       * The same user cannot duplicate
       * a story for the same activity.
       */
      const duplicate =
        await handle(request(session));

      expect(duplicate.status)
        .toBe(409);

      /*
       * Test 4:
       * Unknown activities are rejected.
       */
      const invalid =
        await handle(
          request(
            session,
            "unknown-activity",
          ),
        );

      expect(invalid.status)
        .toBe(400);

      /*
       * Test 5:
       * Reassembling the app simulates
       * restarting the backend.
       */
      const restarted =
        assembleApplication(
          database.db,
          undefined,
          {
            ProgressiveContentGenerator:
              generator,
          },
        );

      expect(
        await persistence.restore(restarted),
      ).toBe(true);

      const { progressive } =
        getPersistenceConcepts(restarted);

      const restored =
        progressive.getStory({
          user: "george",
          story: result.story,
        });

      /*
       * Test 6:
       * User profile was used to
       * personalize the story.
       */
      expect(restored.context).toBe(
        "Interested in making movies.",
      );

      /*
       * Test 7:
       * Original chapter ID was preserved.
       */
      expect(
        restored.chapters[0]?.chapter,
      ).toBe(result.chapter);

      /*
       * Test 8:
       * Educational content survived
       * the simulated restart.
       */
      expect(
        restored.chapters[0]?.theory.topic,
      ).toBe("Camera shots");

      expect(
        restored.chapters[0]?.stage,
      ).toBe("first-choice");

      expect(restored.chapters)
        .toHaveLength(1);
    } finally {
      await database.close();
    }
  },
);

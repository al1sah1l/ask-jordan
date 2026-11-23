
import {
  expect,
  test,
} from "bun:test";

import {
  assembleApplication,
  getPersistenceConcepts,
} from "../src/assembly.ts";

import {
  SessioningConcept,
} from "../src/concepts/Sessioning.ts";

import {
  createProgressiveHttpHandler,
} from "../src/learning/progressiveHttp.ts";

import {
  START_PROGRESSIVE_STORY,
} from "../src/learning/progressive-symbols.ts";

import type {
  ProgressiveContentGenerator,
} from "../src/learning/ProgressiveStoryEngine.ts";

import {
  openTestDb,
} from "./test-db.ts";

import {
  seedCatalog,
} from "../src/catalog.ts";

const generator: ProgressiveContentGenerator = {
  async beginChapter() {
    return {
      theory: {
        topic: "Camera shots",
        explanation:
          "Wide shots establish context.",
        keyTerms: ["wide shot"],
      },
      introduction:
        "Alex and Jordan are filming a scene.",
      firstQuestion: {
        prompt: "Which shot would you use?",
        options: ["Wide shot", "Close-up"],
      },
    };
  },

  async afterFirstChoice() {
    return {
      scene: "Alex tries a wide shot.",
      question: {
        prompt: "What next?",
      },
    };
  },

  async afterSecondChoice() {
    return {
      conclusion: "Alex finishes filming.",
      practicalChallenge:
        "Film a 15-second scene.",
    };
  },
};

test(
  "progressive get requires a valid owner session",
  async () => {
    const database = await openTestDb();

    try {
      const application = assembleApplication(
        database.db,
        undefined,
        {
          ProgressiveContentGenerator: generator,
        },
      );

      const catalog = await seedCatalog(application);

      const activity = catalog.activities[0]!.activity;

      const { stories } =
        getPersistenceConcepts(application);

      const started =
        await stories[START_PROGRESSIVE_STORY]({
          user: "george",
          activity,
          context: "",
        });

      const sessions =
        new SessioningConcept(database.db);

      const georgeSession = await sessions.start({
        user: "george",
      });

      const sarahSession = await sessions.start({
        user: "sarah",
      });

      const handle =
        createProgressiveHttpHandler(
          application,
          database.db,
        );

      function request(
        cookie?: string,
        story = started.story,
      ): Request {
        return new Request(
          "http://127.0.0.1:3000/api/stories/progressive/get",
          {
            method: "POST",
            headers: {
              Origin: "http://127.0.0.1:8080",
              "Content-Type": "application/json",
              ...(cookie
                ? {
                    Cookie:
                      `ask-jordan-session=${cookie}`,
                  }
                : {}),
            },
            body: JSON.stringify({ story }),
          },
        );
      }

      const allowed = await handle(
        request(georgeSession.session),
      );

      expect(allowed.status).toBe(200);

      const result = await allowed.json() as {
        story: string;
        chapters: {
          theory: { topic: string };
        }[];
      };

      expect(result.story).toBe(started.story);
      expect(result.chapters[0]?.theory.topic)
        .toBe("Camera shots");

      const unauthorized =
        await handle(request());

      expect(unauthorized.status).toBe(401);

      const foreign = await handle(
        request(sarahSession.session),
      );

      const missing = await handle(
        request(
          sarahSession.session,
          "nonexistent-story",
        ),
      );

      expect(foreign.status).toBe(404);
      expect(missing.status).toBe(404);

      expect(await foreign.json())
        .toEqual(await missing.json());

      const wrongOrigin = new Request(
        "http://127.0.0.1:3000/api/stories/progressive/get",
        {
          method: "POST",
          headers: {
            Origin: "http://unauthorized.example",
            "Content-Type": "application/json",
            Cookie:
              `ask-jordan-session=${georgeSession.session}`,
          },
          body: JSON.stringify({
            story: started.story,
          }),
        },
      );

      expect(
        (await handle(wrongOrigin)).status,
      ).toBe(403);
    } finally {
      await database.close();
    }
  },
);

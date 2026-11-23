
import {
  expect,
  test,
} from "bun:test";

import {
  assembleApplication,
  getPersistenceConcepts,
} from "../src/assembly.ts";

import {
  ApplicationPersistence,
} from "../src/persistence.ts";

import {
  ReflectingConcept,
} from "../src/concepts/Reflecting.ts";

import {
  START_PROGRESSIVE_STORY,
} from "../src/learning/progressive-symbols.ts";

import type {
  ProgressiveContentGenerator,
} from "../src/learning/ProgressiveStoryEngine.ts";

import {
  ChapterNotReady,
} from "../src/learning/ProgressiveChapter.ts";

import { seedCatalog } from "../src/catalog.ts";
import { openTestDb } from "./test-db.ts";

const generator: ProgressiveContentGenerator = {
  async beginChapter(input) {
    return {
      theory: {
        topic:
          input.position === 1
            ? "Camera shots"
            : "Visual composition",
        explanation:
          "Different camera shots communicate different information.",
        keyTerms: ["wide shot", "close-up"],
      },
      introduction:
        `Jordan begins chapter ${input.position}.`,
      firstQuestion: {
        prompt: "Which shot should Jordan use?",
        options: ["Wide shot", "Close-up"],
      },
    };
  },

  async afterFirstChoice({ answer }) {
    return {
      scene: `Jordan tries ${answer}.`,
      question: {
        prompt: "What should Jordan try next?",
      },
    };
  },

  async afterSecondChoice({ answer }) {
    return {
      conclusion:
        `Jordan finishes after choosing ${answer}.`,
      practicalChallenge:
        "Film a short scene with two camera angles.",
    };
  },
};

test(
  "progressive choices, reflection and next chapter survive MongoDB restart",
  async () => {
    const database = await openTestDb();

    try {
      const persistence =
        new ApplicationPersistence(database.db);

      const first = assembleApplication(
        database.db,
        undefined,
        { ProgressiveContentGenerator: generator },
      );

      const catalog = await seedCatalog(first);
      const activity = catalog.activities.find(
        (item) => item.name === "Filmmaking",
      );

      expect(activity).toBeDefined();

      const firstConcepts =
        getPersistenceConcepts(first);

      const started =
        await firstConcepts.stories[
          START_PROGRESSIVE_STORY
        ]({
          user: "george",
          activity: activity!.activity,
          context: "George loves films.",
        });

      await firstConcepts.progressive.submitChoice({
        user: "george",
        story: started.story,
        chapter: started.chapter,
        answer: "Close-up",
        expectedStage: "first-choice",
      });

      // Persist after the first decision.
      await persistence.save(first);

      // Simulate a backend restart.
      const second = assembleApplication(
        database.db,
        undefined,
        { ProgressiveContentGenerator: generator },
      );

      expect(
        await persistence.restore(second),
      ).toBe(true);

      const secondConcepts =
        getPersistenceConcepts(second);

      let restored =
        secondConcepts.progressive.getStory({
          user: "george",
          story: started.story,
        });

      expect(
        restored.chapters[0]?.stage,
      ).toBe("second-choice");

      expect(
        restored.chapters[0]?.firstDecision?.answer,
      ).toBe("Close-up");

      await secondConcepts.progressive.submitChoice({
        user: "george",
        story: started.story,
        chapter: started.chapter,
        answer: "Move closer",
        expectedStage: "second-choice",
      });

      await expect(
        secondConcepts.progressive.nextChapter({
          user: "george",
          story: started.story,
        }),
      ).rejects.toBeInstanceOf(
        ChapterNotReady,
      );

      await expect(
        secondConcepts.progressive.confirmSavedReflection({
          user: "george",
          story: started.story,
          chapter: started.chapter,
        }),
      ).rejects.toBeInstanceOf(
        ChapterNotReady,
      );

      // Sarah's actual Reflecting concept writes
      // the record to MongoDB.
      const reflecting = new ReflectingConcept(
        database.db,
      );

      const saved = await reflecting.save({
        user: "george",
        story: started.story,
        chapter: started.chapter,
        text: "I learned how a close-up shows emotions.",
        images: [],
      });

      await secondConcepts.progressive.confirmSavedReflection({
        user: "george",
        story: started.story,
        chapter: started.chapter,
      });

      const next =
        await secondConcepts.progressive.nextChapter({
          user: "george",
          story: started.story,
        });

      expect(next.chapter).not.toBe(
        started.chapter,
      );

      restored =
        secondConcepts.progressive.getStory({
          user: "george",
          story: started.story,
        });

      expect(restored.chapters).toHaveLength(2);
      expect(restored.chapters[0]?.stage)
        .toBe("reflected");

      expect(
        restored.chapters[0]?.reflectionPage,
      ).toBe(saved.page);

      expect(restored.chapters[1]?.position)
        .toBe(2);

      await persistence.save(second);

      // A second restart also preserves the
      // completed reflection and new chapter.
      const third = assembleApplication(
        database.db,
        undefined,
        { ProgressiveContentGenerator: generator },
      );

      expect(
        await persistence.restore(third),
      ).toBe(true);

      const thirdConcepts =
        getPersistenceConcepts(third);

      const finalStory =
        thirdConcepts.progressive.getStory({
          user: "george",
          story: started.story,
        });

      expect(finalStory.chapters).toHaveLength(2);

      expect(
        finalStory.chapters[0]?.reflectionPage,
      ).toBe(saved.page);

      expect(
        finalStory.chapters[1]?.theory.topic,
      ).toBe("Visual composition");

      expect(
        thirdConcepts.stories.getStories({
          user: "george",
        }).stories,
      ).toEqual([
        expect.objectContaining({
          story: started.story,
          activity: activity!.activity,
          format: "progressive",
        }),
      ]);
    } finally {
      await database.close();
    }
  },
);

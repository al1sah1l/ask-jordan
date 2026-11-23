
import { expect, test } from "bun:test";
import { assembleApplication, getPersistenceConcepts } from "../src/assembly.ts";
import { START_PROGRESSIVE_STORY } from "../src/learning/progressive-symbols.ts";
import { seedCatalog } from "../src/catalog.ts";
import { openTestDb } from "./test-db.ts";
import type { ProgressiveContentGenerator } from "../src/learning/ProgressiveStoryEngine.ts";

test("progressive generator receives selected activity rather than its ID", async () => {
  const database = await openTestDb();
  const receivedActivities: string[] = [];

  const generator: ProgressiveContentGenerator = {
    async beginChapter(input) {
      receivedActivities.push(input.activity);

      return {
        theory: {
          topic: "Camera shots",
          explanation: "A wide shot shows the setting of a scene.",
          keyTerms: ["wide shot", "close-up"],
        },
        introduction: "Alex and Jordan prepare to film a short movie.",
        firstQuestion: {
          prompt: "Which shot should Alex use?",
          options: ["Wide shot", "Close-up"],
        },
      };
    },

    async afterFirstChoice(input) {
      receivedActivities.push(input.activity);
      return {
        scene: "Alex tries a wide shot.",
        question: { prompt: "What should Alex do next?" },
      };
    },

    async afterSecondChoice(input) {
      receivedActivities.push(input.activity);
      return {
        conclusion: "Alex finishes editing the film.",
        practicalChallenge: "Record two shots of the same scene.",
      };
    },
  };

  try {
    const app = assembleApplication(database.db, undefined, {
      ProgressiveContentGenerator: generator,
    });

    const catalog = await seedCatalog(app);
    const filmmaking = catalog.activities.find(activity => activity.name === "Filmmaking");
    expect(filmmaking).toBeDefined();

    const { stories, progressive } = getPersistenceConcepts(app);

    const started = await stories[START_PROGRESSIVE_STORY]({
      user: "george",
      activity: filmmaking!.activity,
      context: "I love creative writing and playing musical instruments.",
    });

    await progressive.submitChoice({
      user: "george",
      story: started.story,
      chapter: started.chapter,
      answer: "Wide shot",
      expectedStage: "first-choice",
    });

    await progressive.submitChoice({
      user: "george",
      story: started.story,
      chapter: started.chapter,
      answer: "Try filming from another angle",
      expectedStage: "second-choice",
    });

    expect(receivedActivities).toHaveLength(3);

    for (const activity of receivedActivities) {
      expect(activity).toContain("Filmmaking");
      expect(activity).toContain("Tell stories through video");
      expect(activity).not.toBe(filmmaking!.activity);
    }

    // Saved stories must still reference the catalog Activity ID.
    const saved = progressive.getStory({ user: "george", story: started.story });
    expect(saved.activity).toBe(filmmaking!.activity);
    expect(saved.context).toContain("creative writing");
  } finally {
    await database.close();
  }
});

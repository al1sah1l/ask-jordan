
import {
  describe,
  expect,
  test,
} from "bun:test";

import {
  StoryAlreadyExists,
  StoryGenerationConcept,
} from "../src/concepts/StoryGeneration.ts";

import {
  ProgressiveStoryEngine,
  type ProgressiveContentGenerator,
} from "../src/learning/ProgressiveStoryEngine.ts";

import {
  START_PROGRESSIVE_STORY,
} from "../src/learning/progressive-symbols.ts";

import {
  EXPORT_STATE,
  RESTORE_STATE,
} from "../src/persistence-symbols.ts";

import type {
  StoryGenerator,
} from "../src/ai/StoryGenerator.ts";

const legacyGenerator: StoryGenerator = {
  async generateChapter(input) {
    if (input.position === 3) {
      return {
        text: "The short film is finished.",
        suggestedActivity:
          "Film a 30-second scene.",
      };
    }

    return {
      text: `Legacy chapter ${input.position}.`,
      question: "What would you try next?",
    };
  },
};

const progressiveGenerator:
  ProgressiveContentGenerator = {
    async beginChapter(input) {
      return {
        theory: {
          topic:
            input.position === 1
              ? "Camera shots"
              : `Deeper concept ${input.position}`,
          explanation:
            "Different camera shots communicate different information.",
          keyTerms: [
            "wide shot",
            "close-up",
          ],
        },
        introduction:
          `Jordan explores chapter ${input.position}.`,
        firstQuestion: {
          prompt: "Which shot would you choose?",
          options: ["Wide shot", "Close-up"],
        },
      };
    },

    async afterFirstChoice({ answer }) {
      return {
        scene: `Jordan tries ${answer}.`,
        question: {
          prompt: "What should happen next?",
        },
      };
    },

    async afterSecondChoice({ answer }) {
      return {
        conclusion:
          `Jordan finishes after choosing ${answer}.`,
        practicalChallenge:
          "Film a short scene using two shots.",
      };
    },
  };

function setup() {
  const engine = new ProgressiveStoryEngine(
    progressiveGenerator,
    async () => null,
  );

  const concept = new StoryGenerationConcept(
    () => crypto.randomUUID(),
    legacyGenerator,
    (activity) => activity,
    engine,
  );

  return { concept, engine };
}

describe("StoryGeneration + ProgressiveStoryEngine", () => {
  test("creates a progressive story through one owner", async () => {
    const { concept } = setup();

    const started =
      await concept[START_PROGRESSIVE_STORY]({
        user: "george",
        activity: "filmmaking",
        context: "Likes movies",
      });

    expect(started.story).toBeString();
    expect(started.chapter).toBeString();

    expect(
      concept.getStories({
        user: "george",
      }).stories,
    ).toEqual([
      expect.objectContaining({
        story: started.story,
        activity: "filmmaking",
        format: "progressive",
      }),
    ]);
  });

  test("legacy cannot duplicate a progressive activity", async () => {
    const { concept } = setup();

    await concept[START_PROGRESSIVE_STORY]({
      user: "george",
      activity: "filmmaking",
      context: "",
    });

    await expect(
      concept.generateStory({
        user: "george",
        activity: "filmmaking",
        context: "",
      }),
    ).rejects.toBeInstanceOf(
      StoryAlreadyExists,
    );
  });

  test("progressive cannot duplicate a legacy activity", async () => {
    const { concept } = setup();

    await concept.generateStory({
      user: "george",
      activity: "filmmaking",
      context: "",
    });

    await expect(
      concept[START_PROGRESSIVE_STORY]({
        user: "george",
        activity: "filmmaking",
        context: "",
      }),
    ).rejects.toBeInstanceOf(
      StoryAlreadyExists,
    );
  });

  test("different users can explore the same activity", async () => {
    const { concept } = setup();

    await concept.generateStory({
      user: "george",
      activity: "filmmaking",
      context: "",
    });

    await concept[START_PROGRESSIVE_STORY]({
      user: "sarah",
      activity: "filmmaking",
      context: "",
    });

    expect(
      concept.getStories({
        user: "george",
      }).stories,
    ).toHaveLength(1);

    expect(
      concept.getStories({
        user: "sarah",
      }).stories,
    ).toHaveLength(1);
  });

  test("restores progressive choices with the legacy snapshot", async () => {
    const first = setup();

    const started =
      await first.concept[START_PROGRESSIVE_STORY]({
        user: "george",
        activity: "filmmaking",
        context: "Enjoys movies",
      });

    await first.engine.submitChoice({
      user: "george",
      story: started.story,
      chapter: started.chapter,
      answer: "Close-up",
      expectedStage: "first-choice",
    });

    const snapshot = JSON.parse(
      JSON.stringify(
        first.concept[EXPORT_STATE](),
      ),
    );

    const restored = setup();

    restored.concept[RESTORE_STATE](
      snapshot,
    );

    const result = restored.engine.getStory({
      user: "george",
      story: started.story,
    });

    expect(result.chapters).toHaveLength(1);

    expect(
      result.chapters[0]?.firstDecision?.answer,
    ).toBe("Close-up");

    expect(
      result.chapters[0]?.stage,
    ).toBe("second-choice");

    expect(
      restored.concept.getStories({
        user: "george",
      }).stories[0]?.format,
    ).toBe("progressive");
  });

  test("old snapshots remain compatible", () => {
    const { concept } = setup();

    concept[RESTORE_STATE]({
      stories: [
        {
          story: "old-story",
          user: "george",
          activity: "robotics",
          context: "",
          chapters: ["old-chapter"],
        },
      ],
      chapters: [
        {
          chapter: "old-chapter",
          story: "old-story",
          position: 1,
          text: "George builds a robot.",
          question: "What next?",
        },
      ],
    });

    expect(
      concept.getStories({
        user: "george",
      }).stories[0]?.format,
    ).toBe("legacy");
  });
});

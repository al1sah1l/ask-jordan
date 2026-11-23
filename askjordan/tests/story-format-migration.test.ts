
import {
  describe,
  expect,
  test,
} from "bun:test";

import {
  StoryGenerationConcept,
} from "../src/concepts/StoryGeneration.ts";

import {
  EXPORT_STATE,
  RESTORE_STATE,
} from "../src/persistence-symbols.ts";

import type {
  StoryGenerationState,
} from "../src/concepts/StoryGeneration.ts";

import type {
  StoryGenerator,
} from "../src/ai/StoryGenerator.ts";

const generator: StoryGenerator = {
  async generateChapter(input) {
    if (input.position === 3) {
      return {
        text: "George finishes making a short film.",
        suggestedActivity:
          "Film a short scene using your phone.",
      };
    }

    return {
      text:
        `George explores filmmaking in part ${input.position}.`,
      question: "What would you do next?",
    };
  },
};

function createConcept() {
  return new StoryGenerationConcept(
    () => crypto.randomUUID(),
    generator,
  );
}

describe("Story format migration", () => {
  test("new Alpha stories are marked legacy", async () => {
    const concept = createConcept();

    const started = await concept.generateStory({
      user: "george",
      activity: "filmmaking",
      context: "George enjoys movies.",
    });

    const stories = concept.getStories({
      user: "george",
    });

    expect(stories.stories).toEqual([
      expect.objectContaining({
        story: started.story,
        activity: "filmmaking",
        format: "legacy",
      }),
    ]);
  });

  test("old MongoDB snapshots without format remain readable", () => {
    const concept = createConcept();

    const legacyState: StoryGenerationState = {
      stories: [
        {
          story: "old-story",
          user: "george",
          activity: "filmmaking",
          context: "Likes movies",
          chapters: ["old-chapter"],
          // Saved before the format field existed.
        },
      ],
      chapters: [
        {
          chapter: "old-chapter",
          story: "old-story",
          position: 1,
          text: "George prepares to film a scene.",
          question: "What should he do next?",
        },
      ],
    };

    concept[RESTORE_STATE](legacyState);

    const story = concept.getStory({
      user: "george",
      story: "old-story",
    });

    expect(story.chapters).toHaveLength(1);
    expect(story.chapters[0]?.chapter).toBe(
      "old-chapter",
    );

    const summaries = concept.getStories({
      user: "george",
    });

    expect(summaries.stories[0]?.format).toBe(
      "legacy",
    );

    const exported = concept[EXPORT_STATE]();

    expect(exported.stories[0]?.format).toBe(
      "legacy",
    );
  });

  test("legacy stories can still be continued after restore", async () => {
    const concept = createConcept();

    concept[RESTORE_STATE]({
      stories: [
        {
          story: "saved-story",
          user: "george",
          activity: "filmmaking",
          context: "Likes movies",
          chapters: ["saved-first"],
        },
      ],
      chapters: [
        {
          chapter: "saved-first",
          story: "saved-story",
          position: 1,
          text: "George is planning his first film.",
          question: "What should George do next?",
        },
      ],
    });

    const next = await concept.continueStory({
      user: "george",
      story: "saved-story",
      answer: "Choose a camera angle.",
      expectedChapter: "saved-first",
    });

    expect(next.chapter).toBeString();

    const result = concept.getStory({
      user: "george",
      story: "saved-story",
    });

    expect(result.chapters).toHaveLength(2);
    expect(result.chapters[0]?.answer).toBe(
      "Choose a camera angle.",
    );
  });

  test("format survives an export and restore cycle", () => {
    const first = createConcept();

    first[RESTORE_STATE]({
      stories: [
        {
          story: "progressive-story",
          user: "george",
          activity: "robotics",
          context: "",
          chapters: ["chapter-one"],
          format: "progressive",
        },
      ],
      chapters: [
        {
          chapter: "chapter-one",
          story: "progressive-story",
          position: 1,
          text: "A robotics introduction.",
        },
      ],
    });

    const snapshot = first[EXPORT_STATE]();

    // Simulate BSON JSON-like serialization.
    const serialized = JSON.parse(
      JSON.stringify(snapshot),
    ) as StoryGenerationState;

    const second = createConcept();
    second[RESTORE_STATE](serialized);

    const stories = second.getStories({
      user: "george",
    });

    expect(stories.stories[0]?.format).toBe(
      "progressive",
    );
  });

  test("legacy continuation cannot modify a progressive story", async () => {
    const concept = createConcept();

    concept[RESTORE_STATE]({
      stories: [
        {
          story: "progressive-story",
          user: "george",
          activity: "filmmaking",
          context: "",
          chapters: ["progressive-chapter"],
          format: "progressive",
        },
      ],
      chapters: [
        {
          chapter: "progressive-chapter",
          story: "progressive-story",
          position: 1,
          text: "Learning about camera shots.",
          question: "Which camera shot would you use?",
        },
      ],
    });

    await expect(
      concept.continueStory({
        user: "george",
        story: "progressive-story",
        answer: "A close-up.",
      }),
    ).rejects.toThrow(
      "Use the progressive chapter flow",
    );

    expect(
      concept.getStory({
        user: "george",
        story: "progressive-story",
      }).chapters,
    ).toHaveLength(1);
  });
});

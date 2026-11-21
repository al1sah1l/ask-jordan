
import { describe, expect, test } from "bun:test";

import {
  StoryGenerationConcept,
  StoryAlreadyExists,
  StoryNotFound,
  InvalidStoryAnswer,
  StoryCannotContinue,
} from "../src/concepts/StoryGeneration.ts";

import type {
  StoryGenerator,
  StoryChapterContext,
  GeneratedStoryChapter,
} from "../src/ai/StoryGenerator.ts";

class MockStoryGenerator implements StoryGenerator {
  readonly calls: StoryChapterContext[] = [];

  async generateChapter(
    input: StoryChapterContext,
  ): Promise<GeneratedStoryChapter> {
    this.calls.push(input);

    return {
      text: `AI chapter ${input.position} about ${input.activity}`,
      question:
        input.position < 3
          ? `Question for chapter ${input.position}?`
          : undefined,
      suggestedActivity:
        input.position === 3
          ? "Write a short song using paper and a pencil."
          : undefined,
    };
  }
}

function createConcept(generator: StoryGenerator = new MockStoryGenerator()) {
  let next = 0;

  return new StoryGenerationConcept(
    () => `id-${++next}`,
    generator,
  );
}

describe("StoryGeneration", () => {
  test("creates a personalized first chapter", async () => {
    const mock = new MockStoryGenerator();
    const concept = createConcept(mock);

    const result = await concept.generateStory({
      user: "george",
      activity: "songwriting",
      context: "George likes music",
    });

    const story = concept.getStory({
      user: "george",
      story: result.story,
    });

    expect(story.chapters).toHaveLength(1);
    expect(story.chapters[0].position).toBe(1);
    expect(story.chapters[0].text).toContain("AI chapter 1");
    expect(story.chapters[0].question).toBeDefined();

    expect(mock.calls).toHaveLength(1);
    expect(mock.calls[0].context).toBe("George likes music");
  });

  test("continues the story using previous answers", async () => {
    const mock = new MockStoryGenerator();
    const concept = createConcept(mock);

    const initial = await concept.generateStory({
      user: "george",
      activity: "songwriting",
      context: "George likes music",
    });

    await concept.continueStory({
      user: "george",
      story: initial.story,
      answer: "I want to write lyrics",
    });

    await concept.continueStory({
      user: "george",
      story: initial.story,
      answer: "I want to create a chorus",
    });

    const completed = concept.getStory({
      user: "george",
      story: initial.story,
    });

    expect(completed.chapters).toHaveLength(3);
    expect(completed.chapters[2].position).toBe(3);
    expect(completed.chapters[2].question).toBeUndefined();
    expect(completed.chapters[2].suggestedActivity).toBe(
      "Write a short song using paper and a pencil.",
    );

    expect(mock.calls).toHaveLength(3);
    expect(mock.calls[1].previousChapters[0].answer).toBe(
      "I want to write lyrics",
    );
    expect(mock.calls[2].previousChapters[1].answer).toBe(
      "I want to create a chorus",
    );
  });

  test("rejects duplicate stories", async () => {
    const concept = createConcept();

    await concept.generateStory({
      user: "george",
      activity: "photography",
      context: "",
    });

    await expect(
      concept.generateStory({
        user: "george",
        activity: "photography",
        context: "",
      }),
    ).rejects.toBeInstanceOf(StoryAlreadyExists);
  });

  test("rejects continuing a completed story", async () => {
    const concept = createConcept();

    const initial = await concept.generateStory({
      user: "george",
      activity: "photography",
      context: "",
    });

    await concept.continueStory({
      user: "george",
      story: initial.story,
      answer: "Portraits",
    });

    await concept.continueStory({
      user: "george",
      story: initial.story,
      answer: "Natural light",
    });

    await expect(
      concept.continueStory({
        user: "george",
        story: initial.story,
        answer: "Another chapter",
      }),
    ).rejects.toBeInstanceOf(StoryCannotContinue);
  });

  test("prevents another user from accessing a story", async () => {
    const concept = createConcept();

    const initial = await concept.generateStory({
      user: "george",
      activity: "songwriting",
      context: "",
    });

    expect(() =>
      concept.getStory({
        user: "sarah",
        story: initial.story,
      }),
    ).toThrow(StoryNotFound);

    await expect(
      concept.continueStory({
        user: "sarah",
        story: initial.story,
        answer: "Hello",
      }),
    ).rejects.toBeInstanceOf(StoryNotFound);

    expect(
      concept.getStories({ user: "sarah" }).stories,
    ).toEqual([]);
  });

  test("rejects blank answers", async () => {
    const concept = createConcept();

    const initial = await concept.generateStory({
      user: "george",
      activity: "songwriting",
      context: "",
    });

    await expect(
      concept.continueStory({
        user: "george",
        story: initial.story,
        answer: "   ",
      }),
    ).rejects.toBeInstanceOf(InvalidStoryAnswer);

    expect(
      concept.getStory({
        user: "george",
        story: initial.story,
      }).chapters,
    ).toHaveLength(1);
  });

  test("uses fallback content when AI fails", async () => {
    const failingGenerator: StoryGenerator = {
      async generateChapter() {
        throw new Error("Simulated API outage");
      },
    };

    const concept = createConcept(failingGenerator);

    const initial = await concept.generateStory({
      user: "george",
      activity: "songwriting",
      context: "Likes music",
    });

    await concept.continueStory({
      user: "george",
      story: initial.story,
      answer: "Writing lyrics",
    });

    await concept.continueStory({
      user: "george",
      story: initial.story,
      answer: "Creating a melody",
    });

    const story = concept.getStory({
      user: "george",
      story: initial.story,
    });

    expect(story.chapters).toHaveLength(3);
    expect(story.chapters[0].text).toContain("songwriting");
    expect(story.chapters[2].suggestedActivity).toBeDefined();
  });

  test("uses fallback when AI returns incomplete data", async () => {
    const invalidGenerator: StoryGenerator = {
      async generateChapter() {
        return {
          text: "Incomplete AI story",
        };
      },
    };

    const concept = createConcept(invalidGenerator);

    const initial = await concept.generateStory({
      user: "george",
      activity: "photography",
      context: "",
    });

    const story = concept.getStory({
      user: "george",
      story: initial.story,
    });

    expect(story.chapters).toHaveLength(1);
    expect(story.chapters[0].question).toBeDefined();
    expect(story.chapters[0].text).not.toBe(
      "Incomplete AI story",
    );
  });
});

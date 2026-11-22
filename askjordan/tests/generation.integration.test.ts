
import { describe, expect, test } from "bun:test";

import { assembleApplication } from "../src/assembly.ts";
import { StoryGenerationConcept } from "../src/concepts/StoryGeneration.ts";
import { InterestGenerationConcept } from "../src/concepts/InterestGeneration.ts";

import type {
  StoryGenerator,
  StoryChapterContext,
  GeneratedStoryChapter,
} from "../src/ai/StoryGenerator.ts";

import type {
  InterestGenerator,
  InterestGenerationInput,
} from "../src/ai/InterestGenerator.ts";

class MockStoryGenerator implements StoryGenerator {
  async generateChapter(
    input: StoryChapterContext,
  ): Promise<GeneratedStoryChapter> {
    return {
      text: `Chapter ${input.position} about ${input.activity}.`,
      question:
        input.position < 3
          ? `What happens next in chapter ${input.position}?`
          : undefined,
      suggestedActivity:
        input.position === 3
          ? `Try ${input.activity} for ten minutes.`
          : undefined,
    };
  }
}

class MockInterestGenerator implements InterestGenerator {
  async recommendActivities(
    input: InterestGenerationInput,
  ): Promise<string[]> {
    return input.candidates
      .slice(0, input.limit)
      .map((item) => item.activity);
  }
}

function createTestApplication() {
  return assembleApplication({
    StoryGeneration: new StoryGenerationConcept(
      () => crypto.randomUUID(),
      new MockStoryGenerator(),
    ),

    InterestGeneration: new InterestGenerationConcept(
      () => crypto.randomUUID(),
      new MockInterestGenerator(),
    ),
  });
}

function requireString(
  result: unknown,
  field: string,
): string {
  if (
    typeof result !== "object" ||
    result === null
  ) {
    throw new Error(
      `Expected an object: ${JSON.stringify(result)}`,
    );
  }

  const value = (
    result as Record<string, unknown>
  )[field];

  if (typeof value !== "string") {
    throw new Error(
      `Expected string field "${field}": ${JSON.stringify(result)}`,
    );
  }

  return value;
}

function requireArray(
  result: unknown,
  field: string,
): unknown[] {
  if (
    typeof result !== "object" ||
    result === null
  ) {
    throw new Error(
      `Expected an object: ${JSON.stringify(result)}`,
    );
  }

  const value = (
    result as Record<string, unknown>
  )[field];

  if (!Array.isArray(value)) {
    throw new Error(
      `Expected array field "${field}": ${JSON.stringify(result)}`,
    );
  }

  return value;
}

function expectRefusal(
  result: unknown,
  error: string,
): void {
  expect(result).toMatchObject({
    error,
    detail: expect.any(String),
  });
}

describe("Ask Jordan - Generation Integration Tests", () => {
  test("registers both generation concepts", () => {
    const app = createTestApplication();

    expect(app.concepts.InterestGeneration).toBeDefined();
    expect(app.concepts.StoryGeneration).toBeDefined();
  });

  test("generates suggestions from InterestCollection", async () => {
    const app = createTestApplication();

    const collection = app.concepts.InterestCollection;
    const generation = app.concepts.InterestGeneration;

    const topicResult = await collection.registerTopic({
      name: "Music",
      description: "Exploring music",
    });

    const music = requireString(topicResult, "topic");

    const songwritingResult =
      await collection.registerActivity({
        name: "Songwriting",
        description: "Writing songs",
        topics: [music],
      });

    const photographyResult =
      await collection.registerActivity({
        name: "Photography",
        description: "Taking photos",
        topics: [music],
      });

    const songwriting = requireString(
      songwritingResult,
      "activity",
    );

    const photography = requireString(
      photographyResult,
      "activity",
    );

    await collection.setPreference({
      user: "george",
      subject: music,
      status: "interested",
    });

    const result = await generation.generateSuggestions({
      user: "george",
      preferences: await collection._preferences({
        user: "george",
      }),
      activities: await collection._activities({}),
      connections: await collection._connections({}),
      startedActivities: [],
    });

    expect(
      requireArray(result, "suggestions"),
    ).toHaveLength(2);

    const suggestions = await generation._getSuggestions({
      user: "george",
    });

    expect(suggestions).toHaveLength(2);

    const ids = suggestions.map((item) => item.activity);

    expect(ids).toContain(songwriting);
    expect(ids).toContain(photography);
  });

  test("does not regenerate dismissed suggestions", async () => {
    const app = createTestApplication();
    const generation = app.concepts.InterestGeneration;

    const input = {
      user: "george",
      preferences: [],
      activities: [
        {
          activity: "songwriting",
          name: "Songwriting",
          description: "Writing songs",
        },
        {
          activity: "photography",
          name: "Photography",
          description: "Taking photos",
        },
      ],
      connections: [],
      startedActivities: [],
    };

    await generation.generateSuggestions(input);

    const initial = await generation._getSuggestions({
      user: "george",
    });

    expect(initial).toHaveLength(2);

    const dismissed = initial[0];

    const dismissal = await generation.dismissSuggestion({
      user: "george",
      suggestion: dismissed.suggestion,
    });

    expect(
      requireString(dismissal, "suggestion"),
    ).toBe(dismissed.suggestion);

    await generation.generateSuggestions(input);

    const next = await generation._getSuggestions({
      user: "george",
    });

    expect(next).toHaveLength(1);

    expect(
      next.some(
        (item) => item.activity === dismissed.activity,
      ),
    ).toBe(false);
  });

  test("generates and completes a three-chapter story", async () => {
    const app = createTestApplication();
    const stories = app.concepts.StoryGeneration;

    const initial = await stories.generateStory({
      user: "george",
      activity: "songwriting",
      context: "George likes music and soccer",
    });

    const story = requireString(initial, "story");
    const firstChapter = requireString(initial, "chapter");

    const first = await stories.getStory({
      user: "george",
      story,
    });

    expect(
      requireArray(first, "chapters"),
    ).toHaveLength(1);

    expect(
      requireArray(first, "chapters")[0],
    ).toMatchObject({
      chapter: firstChapter,
      position: 1,
    });

    const second = await stories.continueStory({
      user: "george",
      story,
      answer: "I want to learn how to write lyrics",
    });

    const secondChapter = requireString(
      second,
      "chapter",
    );

    const middle = await stories.getStory({
      user: "george",
      story,
    });

    const middleChapters = requireArray(
      middle,
      "chapters",
    );

    expect(middleChapters).toHaveLength(2);
    expect(middleChapters[0]).toMatchObject({
      answer: "I want to learn how to write lyrics",
    });
    expect(middleChapters[1]).toMatchObject({
      chapter: secondChapter,
      position: 2,
    });

    const third = await stories.continueStory({
      user: "george",
      story,
      answer: "I want to create my own song",
    });

    const thirdChapter = requireString(
      third,
      "chapter",
    );

    const completed = await stories.getStory({
      user: "george",
      story,
    });

    const chapters = requireArray(
      completed,
      "chapters",
    );

    expect(chapters).toHaveLength(3);
    expect(chapters[2]).toMatchObject({
      chapter: thirdChapter,
      position: 3,
      suggestedActivity: expect.any(String),
    });

    const userStories = await stories.getStories({
      user: "george",
    });

    expect(
      requireArray(userStories, "stories"),
    ).toHaveLength(1);
  });

  test("rejects duplicate stories", async () => {
    const app = createTestApplication();
    const stories = app.concepts.StoryGeneration;

    const initial = await stories.generateStory({
      user: "george",
      activity: "photography",
      context: "",
    });

    requireString(initial, "story");

    const duplicate = await stories.generateStory({
      user: "george",
      activity: "photography",
      context: "",
    });

    expectRefusal(duplicate, "STORY_ALREADY_EXISTS");

    const userStories = await stories.getStories({
      user: "george",
    });

    expect(
      requireArray(userStories, "stories"),
    ).toHaveLength(1);
  });

  test("rejects blank story answers", async () => {
    const app = createTestApplication();
    const stories = app.concepts.StoryGeneration;

    const initial = await stories.generateStory({
      user: "george",
      activity: "filmmaking",
      context: "",
    });

    const story = requireString(initial, "story");

    const result = await stories.continueStory({
      user: "george",
      story,
      answer: "   ",
    });

    expectRefusal(result, "INVALID_STORY_ANSWER");

    const current = await stories.getStory({
      user: "george",
      story,
    });

    expect(
      requireArray(current, "chapters"),
    ).toHaveLength(1);
  });

  test("rejects continuing a completed story", async () => {
    const app = createTestApplication();
    const stories = app.concepts.StoryGeneration;

    const initial = await stories.generateStory({
      user: "george",
      activity: "photography",
      context: "",
    });

    const story = requireString(initial, "story");

    await stories.continueStory({
      user: "george",
      story,
      answer: "Portraits",
    });

    await stories.continueStory({
      user: "george",
      story,
      answer: "Natural light",
    });

    const result = await stories.continueStory({
      user: "george",
      story,
      answer: "Another chapter",
    });

    expectRefusal(result, "STORY_CANNOT_CONTINUE");

    const current = await stories.getStory({
      user: "george",
      story,
    });

    expect(
      requireArray(current, "chapters"),
    ).toHaveLength(3);
  });

  test("prevents accessing another user's story", async () => {
    const app = createTestApplication();
    const stories = app.concepts.StoryGeneration;

    const initial = await stories.generateStory({
      user: "george",
      activity: "songwriting",
      context: "",
    });

    const story = requireString(initial, "story");

    const readResult = await stories.getStory({
      user: "sarah",
      story,
    });

    expectRefusal(readResult, "STORY_NOT_FOUND");

    const continueResult = await stories.continueStory({
      user: "sarah",
      story,
      answer: "I want to continue",
    });

    expectRefusal(continueResult, "STORY_NOT_FOUND");

    const sarahStories = await stories.getStories({
      user: "sarah",
    });

    expect(
      requireArray(sarahStories, "stories"),
    ).toEqual([]);

    const georgeStory = await stories.getStory({
      user: "george",
      story,
    });

    expect(
      requireArray(georgeStory, "chapters"),
    ).toHaveLength(1);
  });
});

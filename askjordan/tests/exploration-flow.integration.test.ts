
import {
  describe,
  expect,
  test,
} from "bun:test";

import {
  assembleApplication,
} from "../src/assembly.ts";

import {
  StoryGenerationConcept,
} from "../src/concepts/StoryGeneration.ts";

import type {
  StoryGenerator,
  StoryChapterContext,
  GeneratedStoryChapter,
} from "../src/ai/StoryGenerator.ts";

import {
  startStoryExploration,
  completeStoryExploration,
} from "../src/workflows/ExplorationFlow.ts";

class MockStoryGenerator implements StoryGenerator {
  async generateChapter(
    input: StoryChapterContext,
  ): Promise<GeneratedStoryChapter> {
    return {
      text:
        `Chapter ${input.position} about ${input.activity}.`,
      question:
        input.position < 3
          ? "What would you like to explore next?"
          : undefined,
      suggestedActivity:
        input.position === 3
          ? "Try the activity for ten minutes."
          : undefined,
    };
  }
}

function createTestApp() {
  return assembleApplication({
    StoryGeneration: new StoryGenerationConcept(
      () => crypto.randomUUID(),
      new MockStoryGenerator(),
    ),
  });
}

function requireString(
  value: unknown,
  field: string,
): string {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    throw new Error("Expected object result.");
  }

  const record = value as Record<string, unknown>;

  if (typeof record[field] !== "string") {
    throw new Error(
      `Expected string ${field}: ${JSON.stringify(value)}`,
    );
  }

  return record[field];
}

describe("Story Exploration Synchronization", () => {
  test("automatically starts exploration after successful story generation", async () => {
    const app = createTestApp();

    // Call StoryGeneration directly, not the workflow.
    const result =
      await app.concepts.StoryGeneration.generateStory({
        user: "george",
        activity: "photography",
        context: "George likes soccer",
      });

    const story = requireString(result, "story");

    const explorations =
      await app.concepts.ExplorationTracking._get({
        user: "george",
        story,
      });

    expect(explorations).toHaveLength(1);
    expect(explorations[0]).toMatchObject({
      user: "george",
      story,
      status: "started",
    });
  });

  test("does not create another exploration when story generation is refused", async () => {
    const app = createTestApp();

    const first =
      await app.concepts.StoryGeneration.generateStory({
        user: "george",
        activity: "photography",
        context: "",
      });

    const story = requireString(first, "story");

    const second =
      await app.concepts.StoryGeneration.generateStory({
        user: "george",
        activity: "photography",
        context: "",
      });

    expect(second).toMatchObject({
      error: "STORY_ALREADY_EXISTS",
    });

    const explorations =
      await app.concepts.ExplorationTracking._history({
        user: "george",
      });

    expect(explorations).toHaveLength(1);
    expect(explorations[0].story).toBe(story);
  });

  test("workflow uses the exploration created by the reaction", async () => {
    const app = createTestApp();

    const result = await startStoryExploration(app, {
      user: "george",
      activity: "songwriting",
      context: "",
    });

    expect(result.story).toBeTruthy();
    expect(result.chapter).toBeTruthy();
    expect(result.exploration).toBeTruthy();

    const history =
      await app.concepts.ExplorationTracking._history({
        user: "george",
      });

    expect(history).toHaveLength(1);

    expect(history[0]).toMatchObject({
      exploration: result.exploration,
      story: result.story,
      status: "started",
    });
  });

  test("does not complete an unfinished story", async () => {
    const app = createTestApp();

    const started = await startStoryExploration(app, {
      user: "george",
      activity: "filmmaking",
      context: "",
    });

    await expect(
      completeStoryExploration(app, {
        user: "george",
        story: started.story,
      }),
    ).rejects.toThrow(
      "finish all three chapters",
    );

    const history =
      await app.concepts.ExplorationTracking._history({
        user: "george",
      });

    expect(history[0].status).toBe("started");
  });

  test("completes exploration after three chapters and explicit confirmation", async () => {
    const app = createTestApp();

    const started = await startStoryExploration(app, {
      user: "george",
      activity: "photography",
      context: "George likes soccer",
    });

    await app.concepts.StoryGeneration.continueStory({
      user: "george",
      story: started.story,
      answer: "Photograph a soccer game",
    });

    await app.concepts.StoryGeneration.continueStory({
      user: "george",
      story: started.story,
      answer: "Try capturing movement",
    });

    // Finishing chapter 3 must not automatically
    // complete the exploration.
    const before =
      await app.concepts.ExplorationTracking._get({
        user: "george",
        story: started.story,
      });

    expect(before[0].status).toBe("started");

    const completed = await completeStoryExploration(
      app,
      {
        user: "george",
        story: started.story,
      },
    );

    expect(completed.exploration).toBe(
      started.exploration,
    );

    const after =
      await app.concepts.ExplorationTracking._completed({
        user: "george",
      });

    expect(after).toHaveLength(1);
    expect(after[0].status).toBe("completed");
  });

  test("prevents another user from completing a story", async () => {
    const app = createTestApp();

    const started = await startStoryExploration(app, {
      user: "george",
      activity: "songwriting",
      context: "",
    });

    await expect(
      completeStoryExploration(app, {
        user: "sarah",
        story: started.story,
      }),
    ).rejects.toThrow("STORY_NOT_FOUND");

    const current =
      await app.concepts.ExplorationTracking._get({
        user: "george",
        story: started.story,
      });

    expect(current[0].status).toBe("started");
  });
});

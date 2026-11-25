
import {
  afterAll,
  beforeAll,
  expect,
  test,
} from "bun:test";

import { openTestDb, type TestDb } from "./test-db.ts";
import { assembleApplication } from "../src/assembly.ts";
import { seedCatalog } from "../src/catalog.ts";
import { ApplicationPersistence } from "../src/persistence.ts";
import { StoryGenerationConcept } from "../src/concepts/StoryGeneration.ts";

import type {
  StoryGenerator,
} from "../src/ai/StoryGenerator.ts";

let testDb: TestDb;

const generator: StoryGenerator = {
  async generateChapter(input) {
    if (input.position === 3) {
      return {
        text: "George finishes his filmmaking project.",
        suggestedActivity:
          "Film a 30-second scene using three camera angles.",
      };
    }

    return {
      text:
        `Chapter ${input.position}: George explores filmmaking.`,
      question: "What should George try next?",
    };
  },
};

function createApplication() {
  return assembleApplication(
    testDb.db,
    undefined,
    {
      StoryGeneration: new StoryGenerationConcept(
        () => crypto.randomUUID(),
        generator,
      ),
    },
  );
}

beforeAll(async () => {
  testDb = await openTestDb();
});

afterAll(async () => {
  await testDb?.close();
});

test(
  "interests, stories, answers and explorations survive restart",
  async () => {
    await testDb.db.dropDatabase();

    const persistence = new ApplicationPersistence(
      testDb.db,
    );

    // ----------------------------------
    // 1. Create the first application
    // ----------------------------------

    const first = createApplication();

    const originalCatalog = await seedCatalog(first);

    const filmmaking = originalCatalog.activities.find(
      (activity) => activity.name === "Filmmaking",
    );

    expect(filmmaking).toBeDefined();

    if (!filmmaking) {
      throw new Error("Filmmaking activity was not seeded.");
    }

    const activityId = filmmaking.activity;

    // ----------------------------------
    // 2. Save an interest
    // ----------------------------------

    const preference =
      await first.concepts.InterestCollection.setPreference({
        user: "george",
        subject: activityId,
        status: "interested",
      });

    expect(preference).toHaveProperty("preference");

    // ----------------------------------
    // 3. Generate a story
    // ----------------------------------

    const started =
      await first.concepts.StoryGeneration.generateStory({
        user: "george",
        activity: activityId,
        context: "I enjoy making short videos.",
      });

    // Sync-engine results can include ActionRefusal.
    // Verify the successful result before using its ID.
    if (
      !("story" in started) ||
      typeof started.story !== "string"
    ) {
      throw new Error(
        `Could not create story: ${JSON.stringify(started)}`,
      );
    }

    const storyId: string = started.story;

    // ----------------------------------
    // 4. Continue the story
    // ----------------------------------

    const continued =
      await first.concepts.StoryGeneration.continueStory({
        user: "george",
        story: storyId,
        answer: "I want to use a close-up shot.",
      });

    expect(continued).toHaveProperty("chapter");

    const finished = await first.concepts.StoryGeneration.continueStory({
      user: "george", story: storyId, answer: "Finish with a wide shot.",
    });
    expect(finished).toHaveProperty("chapter");

    const originalChapters =
      await first.concepts.StoryGeneration.getStory({
        user: "george",
        story: storyId,
      });

    if (
      !("chapters" in originalChapters) ||
      !Array.isArray(originalChapters.chapters)
    ) {
      throw new Error(
        "Story chapters were not returned.",
      );
    }

    expect(originalChapters.chapters).toHaveLength(3);

    expect(originalChapters.chapters[0]).toEqual(
      expect.objectContaining({
        answer: "I want to use a close-up shot.",
      }),
    );

    // ----------------------------------
    // 5. Save everything to MongoDB
    // ----------------------------------

    await persistence.save(first);

    // ----------------------------------
    // 6. Simulate a backend restart
    // ----------------------------------

    const second = createApplication();

    const restored = await persistence.restore(second);

    expect(restored).toBe(true);

    // ----------------------------------
    // 7. Verify catalog IDs are preserved
    // ----------------------------------

    const restoredCatalog = await seedCatalog(second);

    const restoredFilmmaking =
      restoredCatalog.activities.find(
        (activity) => activity.name === "Filmmaking",
      );

    expect(restoredFilmmaking?.activity).toBe(activityId);

    // ----------------------------------
    // 8. Verify saved preferences
    // ----------------------------------

    const savedPreferences =
      await second.concepts.InterestCollection
        ._preferences({ user: "george" });

    expect(savedPreferences).toEqual([
      expect.objectContaining({
        subject: activityId,
        status: "interested",
      }),
    ]);

    // ----------------------------------
    // 9. Verify saved stories
    // ----------------------------------

    const savedStories =
      await second.concepts.StoryGeneration.getStories({
        user: "george",
      });

    if (
      !("stories" in savedStories) ||
      !Array.isArray(savedStories.stories)
    ) {
      throw new Error("Saved stories were not returned.");
    }

    expect(savedStories.stories).toEqual([
      expect.objectContaining({
        story: storyId,
        activity: activityId,
      }),
    ]);

    // ----------------------------------
    // 10. Verify chapters and answers
    // ----------------------------------

    const savedStory =
      await second.concepts.StoryGeneration.getStory({
        user: "george",
        story: storyId,
      });

    if (
      !("chapters" in savedStory) ||
      !Array.isArray(savedStory.chapters)
    ) {
      throw new Error("Saved chapters were not returned.");
    }

    expect(savedStory.chapters).toHaveLength(3);

    expect(savedStory.chapters[0]).toEqual(
      expect.objectContaining({
        answer: "I want to use a close-up shot.",
      }),
    );
    expect(savedStory.chapters[1]).toEqual(expect.objectContaining({ answer: "Finish with a wide shot." }));
    expect(savedStory.chapters[2]).toEqual(expect.objectContaining({
      text: "George finishes his filmmaking project.",
      suggestedActivity: "Film a 30-second scene using three camera angles.",
    }));

    // ----------------------------------
    // 11. Verify exploration history
    // ----------------------------------

    const history =
      await second.concepts.ExplorationTracking
        ._history({ user: "george" });

    expect(history).toEqual([
      expect.objectContaining({
        story: storyId,
        status: "started",
      }),
    ]);

    // ----------------------------------
    // 12. Verify user isolation
    // ----------------------------------

    const forbidden =
      await second.concepts.StoryGeneration.getStory({
        user: "sarah",
        story: storyId,
      });

    expect(forbidden).toHaveProperty(
      "error",
      "GET_STORY_NOT_FOUND",
    );
  },
);

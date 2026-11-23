
import { expect, test } from "bun:test";

import { StoryGenerationConcept } from "../src/concepts/StoryGeneration.ts";
import { CatalogEntryNotFound } from "../src/concepts/InterestCollection.ts";

import type {
  StoryChapterContext,
  StoryGenerator,
} from "../src/ai/StoryGenerator.ts";

test("AI receives the catalog activity name, not its ID", async () => {
  const received: StoryChapterContext[] = [];

  const generator: StoryGenerator = {
    async generateChapter(input) {
      received.push(input);

      return {
        text: "Alex films a short scene with a phone.",
        question: "Which camera angle should Alex try?",
      };
    },
  };

  const concept = new StoryGenerationConcept(
    () => crypto.randomUUID(),
    generator,
    (activityId) => {
      expect(activityId).toBe("filmmaking-id");

      return (
        "Filmmaking — Tell stories through " +
        "video, filming, and editing."
      );
    },
  );

  const result = await concept.generateStory({
    user: "alex",
    activity: "filmmaking-id",
    context: "Enjoys movies.",
  });

  expect(result.story).toBeString();

  expect(received).toHaveLength(1);

  expect(received[0]?.activity).toContain("Filmmaking");
  expect(received[0]?.activity).toContain("video");
  expect(received[0]?.activity).not.toContain("filmmaking-id");

  // Original ID is retained in the story record.
  const stories = concept.getStories({ user: "alex" });
  expect(stories.stories[0]?.activity).toBe("filmmaking-id");
});

test("unknown activities are rejected before generation", async () => {
  let generated = false;

  const generator: StoryGenerator = {
    async generateChapter() {
      generated = true;

      return {
        text: "This should not be generated.",
        question: "What next?",
      };
    },
  };

  const concept = new StoryGenerationConcept(
    undefined,
    generator,
    () => {
      throw new CatalogEntryNotFound("Unknown activity.");
    },
  );

  await expect(
    concept.generateStory({
      user: "alex",
      activity: "unknown-id",
      context: "",
    }),
  ).rejects.toBeInstanceOf(CatalogEntryNotFound);

  expect(generated).toBe(false);
});

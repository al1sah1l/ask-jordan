
import { describe, expect, test } from "bun:test";

import {
  InterestGenerationConcept,
  NoActivitiesAvailable,
  SuggestionNotFound,
} from "../src/concepts/InterestGeneration.ts";

import type {
  InterestGenerator,
  InterestGenerationInput,
} from "../src/ai/InterestGenerator.ts";

class MockInterestGenerator implements InterestGenerator {
  readonly calls: InterestGenerationInput[] = [];

  async recommendActivities(
    input: InterestGenerationInput,
  ): Promise<string[]> {
    this.calls.push(input);

    return input.candidates
      .slice(0, input.limit)
      .map((item) => item.activity);
  }
}

function createConcept(
  generator: InterestGenerator = new MockInterestGenerator(),
) {
  let next = 0;

  return new InterestGenerationConcept(
    () => `suggestion-${++next}`,
    generator,
  );
}

const activities = [
  {
    activity: "songwriting",
    name: "Songwriting",
    description: "Writing songs",
  },
  {
    activity: "photography",
    name: "Photography",
    description: "Taking photographs",
  },
  {
    activity: "music-production",
    name: "Music Production",
    description: "Producing music",
  },
];

const preferences = [
  {
    preference: "pref-1",
    user: "george",
    subject: "music",
    status: "interested" as const,
  },
];

const connections = [
  {
    connection: "connection-1",
    first: "music",
    second: "songwriting",
  },
  {
    connection: "connection-2",
    first: "music",
    second: "music-production",
  },
];

function inputFor(user = "george") {
  return {
    user,
    preferences,
    activities,
    connections,
    startedActivities: [] as string[],
  };
}

describe("InterestGeneration", () => {
  test("generates suggestions using the AI generator", async () => {
    const mock = new MockInterestGenerator();
    const concept = createConcept(mock);

    const result = await concept.generateSuggestions(
      inputFor(),
    );

    expect(result.suggestions).toHaveLength(3);
    expect(mock.calls).toHaveLength(1);

    const suggestions = concept._getSuggestions({
      user: "george",
    });

    expect(suggestions).toHaveLength(3);
    expect(
      suggestions.every((item) => item.status === "pending"),
    ).toBe(true);
  });

  test("excludes started activities before calling AI", async () => {
    const mock = new MockInterestGenerator();
    const concept = createConcept(mock);

    await concept.generateSuggestions({
      ...inputFor(),
      startedActivities: ["songwriting"],
    });

    expect(
      mock.calls[0].candidates.some(
        (item) => item.activity === "songwriting",
      ),
    ).toBe(false);

    expect(
      concept._getSuggestions({ user: "george" }),
    ).toHaveLength(2);
  });

  test("does not recommend dismissed activities again", async () => {
    const mock = new MockInterestGenerator();
    const concept = createConcept(mock);

    await concept.generateSuggestions(inputFor());

    const initial = concept._getSuggestions({
      user: "george",
    });

    const dismissed = initial[0];

    concept.dismissSuggestion({
      user: "george",
      suggestion: dismissed.suggestion,
    });

    await concept.generateSuggestions(inputFor());

    const next = concept._getSuggestions({
      user: "george",
    });

    expect(next).toHaveLength(2);
    expect(
      next.some(
        (item) => item.activity === dismissed.activity,
      ),
    ).toBe(false);
  });

  test("keeps users independent", async () => {
    const concept = createConcept();

    await concept.generateSuggestions(inputFor("george"));

    expect(
      concept._getSuggestions({ user: "sarah" }),
    ).toEqual([]);

    await concept.generateSuggestions(inputFor("sarah"));

    expect(
      concept._getSuggestions({ user: "george" }),
    ).toHaveLength(3);

    expect(
      concept._getSuggestions({ user: "sarah" }),
    ).toHaveLength(3);
  });

  test("rejects an empty catalog", async () => {
    const concept = createConcept();

    await expect(
      concept.generateSuggestions({
        ...inputFor(),
        activities: [],
      }),
    ).rejects.toBeInstanceOf(NoActivitiesAvailable);
  });

  test("uses deterministic fallback when AI fails", async () => {
    const failingGenerator: InterestGenerator = {
      async recommendActivities() {
        throw new Error("API unavailable");
      },
    };

    const concept = createConcept(failingGenerator);

    const result = await concept.generateSuggestions(
      inputFor(),
    );

    expect(result.suggestions).toHaveLength(3);

    const suggestions = concept._getSuggestions({
      user: "george",
    });

    expect(suggestions).toHaveLength(3);
  });

  test("rejects invalid IDs returned by AI", async () => {
    const invalidGenerator: InterestGenerator = {
      async recommendActivities() {
        return ["made-up-activity"];
      },
    };

    const concept = createConcept(invalidGenerator);

    await concept.generateSuggestions(inputFor());

    // Falls back to valid catalog activities.
    const suggestions = concept._getSuggestions({
      user: "george",
    });

    expect(suggestions).toHaveLength(3);
    expect(
      suggestions.some(
        (item) => item.activity === "made-up-activity",
      ),
    ).toBe(false);
  });

  test("prevents dismissing another user's suggestion", async () => {
    const concept = createConcept();

    await concept.generateSuggestions(inputFor());

    const first = concept._getSuggestions({
      user: "george",
    })[0];

    expect(() =>
      concept.dismissSuggestion({
        user: "sarah",
        suggestion: first.suggestion,
      }),
    ).toThrow(SuggestionNotFound);
  });
});

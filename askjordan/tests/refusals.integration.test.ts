
import { describe, expect, test } from "bun:test";
import { assembleApplication } from "../src/assembly.ts";

// Extract an ID from a successful sync-engine action.
function requireId(result: unknown, field: string): string {
  if (typeof result !== "object" || result === null) {
    throw new Error(
      `Expected a successful action result for ${field}`,
    );
  }

  const value = (result as Record<string, unknown>)[field];

  if (typeof value !== "string") {
    throw new Error(
      `Expected ${field} to be a string: ${JSON.stringify(result)}`,
    );
  }

  return value;
}

// Verify the refusal format returned by sync-engine 1.2.0.
function expectRefusal(
  result: unknown,
  expectedError: string,
): void {
  expect(result).toMatchObject({
    error: expectedError,
    detail: expect.any(String),
  });
}

describe("Ask Jordan - Integration Refusal Tests", () => {
  test("rejects duplicate topic names", async () => {
    const app = assembleApplication();
    const interests = app.concepts.InterestCollection;

    const first = await interests.registerTopic({
      name: "Music",
      description: "Music activities",
    });

    requireId(first, "topic");

    const duplicate = await interests.registerTopic({
      name: "music",
      description: "Duplicate topic",
    });

    expectRefusal(duplicate, "CATALOG_ENTRY_EXISTS");

    const topics = await interests._topics({});
    expect(topics).toHaveLength(1);
  });

  test("rejects an activity with an unknown topic", async () => {
    const app = assembleApplication();
    const interests = app.concepts.InterestCollection;

    const result = await interests.registerActivity({
      name: "Songwriting",
      description: "Write music",
      topics: ["missing-topic"],
    });

    expectRefusal(result, "CATALOG_ENTRY_NOT_FOUND");

    const activities = await interests._activities({});
    expect(activities).toEqual([]);
  });

  test("rejects duplicate activity connections", async () => {
    const app = assembleApplication();
    const interests = app.concepts.InterestCollection;

    const topicResult = await interests.registerTopic({
      name: "Music",
      description: "Music activities",
    });

    const topic = requireId(topicResult, "topic");

    const firstResult = await interests.registerActivity({
      name: "Songwriting",
      description: "Writing songs",
      topics: [topic],
    });

    const secondResult = await interests.registerActivity({
      name: "Music Production",
      description: "Producing music",
      topics: [topic],
    });

    const first = requireId(firstResult, "activity");
    const second = requireId(secondResult, "activity");

    const connection = await interests.connectActivities({
      activity1: first,
      activity2: second,
    });

    requireId(connection, "connection");

    const duplicate = await interests.connectActivities({
      activity1: second,
      activity2: first,
    });

    expectRefusal(duplicate, "CONNECTION_EXISTS");

    // Two topic-activity connections plus one activity-activity connection.
    const connections = await interests._connections({});
    expect(connections).toHaveLength(3);
  });

  test("rejects starting the same exploration twice", async () => {
    const app = assembleApplication();
    const tracking = app.concepts.ExplorationTracking;

    const first = await tracking.startExploration({
      user: "george",
      story: "story-1",
    });

    requireId(first, "exploration");

    const duplicate = await tracking.startExploration({
      user: "george",
      story: "story-1",
    });

    expectRefusal(
      duplicate,
      "EXPLORATION_ALREADY_STARTED",
    );

    const history = await tracking._history({
      user: "george",
    });

    expect(history).toHaveLength(1);
  });

  test("rejects completion of an exploration that was never started", async () => {
    const app = assembleApplication();
    const tracking = app.concepts.ExplorationTracking;

    const result = await tracking.completeExploration({
      user: "george",
      story: "unknown-story",
    });

    expectRefusal(result, "EXPLORATION_NOT_STARTED");

    const history = await tracking._history({
      user: "george",
    });

    expect(history).toEqual([]);
  });

  test("rejects completing the same exploration twice", async () => {
    const app = assembleApplication();
    const tracking = app.concepts.ExplorationTracking;

    const startResult = await tracking.startExploration({
      user: "george",
      story: "story-1",
    });

    requireId(startResult, "exploration");

    const first = await tracking.completeExploration({
      user: "george",
      story: "story-1",
    });

    const completedId = requireId(first, "exploration");

    const duplicate = await tracking.completeExploration({
      user: "george",
      story: "story-1",
    });

    expectRefusal(
      duplicate,
      "EXPLORATION_NOT_STARTED",
    );

    const completed = await tracking._completed({
      user: "george",
    });

    expect(completed).toHaveLength(1);
    expect(completed[0].exploration).toBe(completedId);
    expect(completed[0].status).toBe("completed");
  });

  test("prevents another user from completing an exploration", async () => {
    const app = assembleApplication();
    const tracking = app.concepts.ExplorationTracking;

    const startResult = await tracking.startExploration({
      user: "george",
      story: "story-1",
    });

    requireId(startResult, "exploration");

    const result = await tracking.completeExploration({
      user: "sarah",
      story: "story-1",
    });

    expectRefusal(result, "EXPLORATION_NOT_STARTED");

    const georgeHistory = await tracking._history({
      user: "george",
    });

    expect(georgeHistory).toHaveLength(1);
    expect(georgeHistory[0].status).toBe("started");

    const sarahHistory = await tracking._history({
      user: "sarah",
    });

    expect(sarahHistory).toEqual([]);
  });
});

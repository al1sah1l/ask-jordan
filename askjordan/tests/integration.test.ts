
import { describe, expect, test } from "bun:test";
import { assembleApplication } from "../src/assembly.ts";

// Extract a string ID from a successful sync-engine action result.
// Fail the test if the action returned a refusal or an invalid result.
function requireStringField(
  result: unknown,
  field: string,
): string {
  if (
    typeof result !== "object" ||
    result === null ||
    !(field in result)
  ) {
    throw new Error(
      `Action failed or did not return "${field}": ${JSON.stringify(result)}`,
    );
  }

  const record = result as Record<string, unknown>;
  const value = record[field];

  if (typeof value !== "string") {
    throw new Error(
      `Expected "${field}" to be a string, got ${typeof value}`,
    );
  }

  return value;
}

describe("Ask Jordan Integration Tests", () => {
  test("both concepts are registered in the assembly", () => {
    const app = assembleApplication();

    expect(app.concepts.InterestCollection).toBeDefined();
    expect(app.concepts.ExplorationTracking).toBeDefined();
  });

  test("creates topics and activities through the assembly", async () => {
    const app = assembleApplication();
    const interests = app.concepts.InterestCollection;

    const musicResult = await interests.registerTopic({
      name: "Music",
      description: "Exploring music",
    });

    const writingResult = await interests.registerTopic({
      name: "Creative Writing",
      description: "Exploring writing",
    });

    const musicTopic = requireStringField(musicResult, "topic");
    const writingTopic = requireStringField(writingResult, "topic");

    const activityResult = await interests.registerActivity({
      name: "Songwriting",
      description: "Creating songs",
      topics: [musicTopic, writingTopic],
    });

    const songwritingActivity = requireStringField(
      activityResult,
      "activity",
    );

    const related = await interests._related({
      subject: songwritingActivity,
    });

    expect(related).toHaveLength(2);

    expect(related).toEqual(
      expect.arrayContaining([
        { subject: musicTopic },
        { subject: writingTopic },
      ]),
    );

    const topics = await interests._topics({});
    const activities = await interests._activities({});
    const connections = await interests._connections({});

    expect(topics).toHaveLength(2);
    expect(activities).toHaveLength(1);
    expect(connections).toHaveLength(2);

    expect(activities[0]).toMatchObject({
      activity: songwritingActivity,
      name: "Songwriting",
    });
  });

  test("stores and updates preferences without duplicates", async () => {
    const app = assembleApplication();
    const interests = app.concepts.InterestCollection;

    const musicResult = await interests.registerTopic({
      name: "Music",
      description: "Music activities",
    });

    const musicTopic = requireStringField(musicResult, "topic");
    const user = "george";

    const initialResult = await interests.setPreference({
      user,
      subject: musicTopic,
      status: "curious",
    });

    const initialPreference = requireStringField(
      initialResult,
      "preference",
    );

    const updatedResult = await interests.setPreference({
      user,
      subject: musicTopic,
      status: "interested",
    });

    const updatedPreference = requireStringField(
      updatedResult,
      "preference",
    );

    // Updating a preference must preserve its identity.
    expect(updatedPreference).toBe(initialPreference);

    const preferences = await interests._preferences({
      user,
    });

    expect(preferences).toHaveLength(1);

    expect(preferences[0]).toMatchObject({
      preference: initialPreference,
      user,
      subject: musicTopic,
      status: "interested",
    });

    // Another user's preferences must remain independent.
    const anotherUserPreferences = await interests._preferences({
      user: "sarah",
    });

    expect(anotherUserPreferences).toEqual([]);
  });

  test("starts and completes an exploration through the assembly", async () => {
    const app = assembleApplication();
    const tracking = app.concepts.ExplorationTracking;

    const user = "george";
    const story = "story-songwriting";

    const startResult = await tracking.startExploration({
      user,
      story,
    });

    const explorationId = requireStringField(
      startResult,
      "exploration",
    );

    // The exploration should initially be started.
    const historyBefore = await tracking._history({
      user,
    });

    expect(historyBefore).toHaveLength(1);

    expect(historyBefore[0]).toMatchObject({
      exploration: explorationId,
      user,
      story,
      status: "started",
    });

    const currentBefore = await tracking._get({
      user,
      story,
    });

    expect(currentBefore).toHaveLength(1);
    expect(currentBefore[0].status).toBe("started");

    // Complete the exploration.
    const completeResult = await tracking.completeExploration({
      user,
      story,
    });

    const completedId = requireStringField(
      completeResult,
      "exploration",
    );

    expect(completedId).toBe(explorationId);

    // The same exploration should now be completed.
    const historyAfter = await tracking._history({
      user,
    });

    expect(historyAfter).toHaveLength(1);

    expect(historyAfter[0]).toMatchObject({
      exploration: explorationId,
      user,
      story,
      status: "completed",
    });

    const completedExplorations = await tracking._completed({
      user,
    });

    expect(completedExplorations).toHaveLength(1);

    expect(completedExplorations[0]).toMatchObject({
      exploration: explorationId,
      story,
      status: "completed",
    });
  });

  test("keeps exploration histories separate for different users", async () => {
    const app = assembleApplication();
    const tracking = app.concepts.ExplorationTracking;

    const georgeResult = await tracking.startExploration({
      user: "george",
      story: "story-1",
    });

    const sarahResult = await tracking.startExploration({
      user: "sarah",
      story: "story-2",
    });

    const georgeId = requireStringField(
      georgeResult,
      "exploration",
    );

    const sarahId = requireStringField(
      sarahResult,
      "exploration",
    );

    expect(georgeId).not.toBe(sarahId);

    const georgeHistory = await tracking._history({
      user: "george",
    });

    const sarahHistory = await tracking._history({
      user: "sarah",
    });

    expect(georgeHistory).toHaveLength(1);
    expect(sarahHistory).toHaveLength(1);

    expect(georgeHistory[0]).toMatchObject({
      exploration: georgeId,
      user: "george",
      story: "story-1",
      status: "started",
    });

    expect(sarahHistory[0]).toMatchObject({
      exploration: sarahId,
      user: "sarah",
      story: "story-2",
      status: "started",
    });

    // George should not see Sarah's story.
    const inaccessibleStory = await tracking._get({
      user: "george",
      story: "story-2",
    });

    expect(inaccessibleStory).toEqual([]);

    const georgeCompleted = await tracking._completed({
      user: "george",
    });

    expect(georgeCompleted).toEqual([]);
  });
});

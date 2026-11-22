
import { describe, expect, test } from "bun:test";

import { assembleApplication } from "../src/assembly.ts";
import { seedCatalog } from "../src/catalog.ts";

describe("Predefined Interest Catalog", () => {
  test("initializes topics and activities", async () => {
    const app = assembleApplication();

    const catalog = await seedCatalog(app);

    expect(catalog.topics).toHaveLength(3);
    expect(catalog.activities).toHaveLength(8);

    expect(
      catalog.activities.some(
        (activity) => activity.name === "Sports Photography",
      ),
    ).toBe(true);
  });

  test("creates relationships between topics and activities", async () => {
    const app = assembleApplication();

    const catalog = await seedCatalog(app);

    const sports = catalog.topics.find(
      (topic) => topic.name === "Sports",
    );

    const photography = catalog.activities.find(
      (activity) => activity.name === "Sports Photography",
    );

    expect(sports).toBeDefined();
    expect(photography).toBeDefined();

    const related = await app.concepts.InterestCollection._related({
      subject: sports!.topic,
    });

    expect(
      related.some((row) => row.subject === photography!.activity),
    ).toBe(true);
  });

  test("can initialize the same catalog twice", async () => {
    const app = assembleApplication();

    const first = await seedCatalog(app);
    const second = await seedCatalog(app);

    expect(second.topics).toHaveLength(first.topics.length);
    expect(second.activities).toHaveLength(first.activities.length);
    expect(second.connections).toHaveLength(first.connections.length);
  });

  test("allows a student to save a preference for a catalog activity", async () => {
    const app = assembleApplication();
    const catalog = await seedCatalog(app);

    const photography = catalog.activities.find(
      (activity) => activity.name === "Sports Photography",
    );

    expect(photography).toBeDefined();

    const saved = await app.concepts.InterestCollection.setPreference({
      user: "george",
      subject: photography!.activity,
      status: "interested",
    });

    expect(saved).toHaveProperty("preference");

    const preferences =
      await app.concepts.InterestCollection._preferences({
        user: "george",
      });

    expect(preferences).toHaveLength(1);
    expect(preferences[0]).toMatchObject({
      user: "george",
      subject: photography!.activity,
      status: "interested",
    });
  });
});

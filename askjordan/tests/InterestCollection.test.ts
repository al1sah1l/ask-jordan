
import { describe, expect, test } from "bun:test";

import {
  InterestCollectionConcept,
  CatalogEntryExists,
  CatalogEntryNotFound,
  ConnectionExists,
} from "../src/concepts/InterestCollection.ts";

const make = () => {
  let next = 0;
  return new InterestCollectionConcept(() => `id-${++next}`);
};

describe("InterestCollection", () => {
  test("connects one activity to multiple topics", () => {
    const c = make();

    const music = c.registerTopic({
      name: "Music",
      description: "",
    }).topic;

    const writing = c.registerTopic({
      name: "Writing",
      description: "",
    }).topic;

    const song = c.registerActivity({
      name: "Songwriting",
      description: "",
      topics: [music, writing],
    }).activity;

    expect(c._related({ subject: song })).toEqual([
      { subject: music },
      { subject: writing },
    ]);

    expect(c._related({ subject: music })).toEqual([
      { subject: song },
    ]);
  });

  test("rejects duplicate topics and unknown references", () => {
    const c = make();

    c.registerTopic({
      name: "Music",
      description: "",
    });

    expect(() =>
      c.registerTopic({
        name: "music",
        description: "",
      })
    ).toThrow(CatalogEntryExists);

    expect(() =>
      c.registerActivity({
        name: "Singing",
        description: "",
        topics: ["missing"],
      })
    ).toThrow(CatalogEntryNotFound);
  });

  test("updates preferences without creating duplicates", () => {
    const c = make();

    const topic = c.registerTopic({
      name: "Music",
      description: "",
    }).topic;

    const first = c.setPreference({
      user: "george",
      subject: topic,
      status: "curious",
    });

    const second = c.setPreference({
      user: "george",
      subject: topic,
      status: "interested",
    });

    expect(first.preference).toBe(second.preference);

    expect(c._preferences({ user: "george" })).toHaveLength(1);

    expect(
      c._preferences({ user: "george" })[0]?.status
    ).toBe("interested");

    expect(c._preferences({ user: "other" })).toEqual([]);
  });

  test("prevents duplicate activity connections", () => {
    const c = make();

    const music = c.registerTopic({
      name: "Music",
      description: "",
    }).topic;

    const songwriting = c.registerActivity({
      name: "Songwriting",
      description: "",
      topics: [music],
    }).activity;

    const singing = c.registerActivity({
      name: "Singing",
      description: "",
      topics: [music],
    }).activity;

    c.connectActivities({
      activity1: songwriting,
      activity2: singing,
    });

    expect(() =>
      c.connectActivities({
        activity1: singing,
        activity2: songwriting,
      })
    ).toThrow(ConnectionExists);
  });
});

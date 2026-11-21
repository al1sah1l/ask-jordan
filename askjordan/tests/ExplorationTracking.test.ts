
import { describe, expect, test } from "bun:test";

import {
  ExplorationTrackingConcept,
  ExplorationAlreadyStarted,
  ExplorationNotStarted,
} from "../src/concepts/ExplorationTracking.ts";

const make = () => {
  let next = 0;
  return new ExplorationTrackingConcept(
    () => `exploration-${++next}`
  );
};

describe("ExplorationTracking", () => {
  test("starts and completes a story", () => {
    const c = make();

    c.startExploration({
      user: "george",
      story: "story-1",
    });

    expect(
      c._get({
        user: "george",
        story: "story-1",
      })[0]?.status
    ).toBe("started");

    c.completeExploration({
      user: "george",
      story: "story-1",
    });

    expect(
      c._completed({ user: "george" })
    ).toHaveLength(1);
  });

  test("rejects duplicate starts and completions", () => {
    const c = make();

    c.startExploration({
      user: "george",
      story: "story-1",
    });

    expect(() =>
      c.startExploration({
        user: "george",
        story: "story-1",
      })
    ).toThrow(ExplorationAlreadyStarted);

    c.completeExploration({
      user: "george",
      story: "story-1",
    });

    expect(() =>
      c.completeExploration({
        user: "george",
        story: "story-1",
      })
    ).toThrow(ExplorationNotStarted);
  });

  test("separates different users", () => {
    const c = make();

    c.startExploration({
      user: "george",
      story: "story-1",
    });

    expect(
      c._history({ user: "another-user" })
    ).toEqual([]);

    expect(() =>
      c.completeExploration({
        user: "another-user",
        story: "story-1",
      })
    ).toThrow(ExplorationNotStarted);
  });
});

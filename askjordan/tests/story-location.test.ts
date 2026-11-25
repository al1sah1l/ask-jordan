import { expect, test } from "bun:test";
import { savedStoryLocation, storyUrl } from "../web/src/utils/storyLocation.ts";

const activities = [{ activity: "robotics", name: "Robotics", description: "Build and test" }];
const stories = [{ story: "saved-story", activity: "robotics", user: "student" }];

test("refresh restores the saved story with its catalog activity name", () => {
  const url = storyUrl(new URL("https://example.com/?theme=light#reader"), "saved-story");
  expect(savedStoryLocation(new URL(url.toString()), stories, activities)).toEqual({
    storyId: "saved-story", activityName: "Robotics",
  });
  expect(url.searchParams.get("theme")).toBe("light");
  expect(url.hash).toBe("#reader");
  expect(savedStoryLocation(storyUrl(url, null), stories, activities)).toBeNull();
});

test("a missing or foreign story cannot be restored from a URL", () => {
  const url = new URL("https://example.com/?story=foreign-story");
  expect(savedStoryLocation(url, stories, activities)).toBeNull();
  url.searchParams.set("story", "saved-story");
  expect(savedStoryLocation(url, [], activities)).toBeNull();
  expect(savedStoryLocation(url, stories, [])).toBeNull();
});

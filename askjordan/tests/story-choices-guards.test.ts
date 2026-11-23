import { expect, test } from "bun:test";
import legacyPrompts from "./fixtures/legacy-prepared-questions.json" with { type: "json" };
import { StoryGenerationConcept, InvalidStoryAnswer, StaleStoryChapter, ActivityNotReached, ActivityStoryNotFound } from "../src/concepts/StoryGeneration.ts";
import { PreparedStoryGenerator } from "../src/ai/PreparedStoryGenerator.ts";
import { EXPORT_STATE, RESTORE_STATE } from "../src/persistence-symbols.ts";
import type { StoryGenerator } from "../src/ai/StoryGenerator.ts";
const start = (concept: StoryGenerationConcept) => concept.generateStory({ user: "alice", activity: "Sports Photography", context: "" });

test("prepared prompts are why questions, and guarded sequential/concurrent retries never answer successors", async () => {
  const concept = new StoryGenerationConcept(undefined, new PreparedStoryGenerator());
  const { story, chapter } = await start(concept);
  const first = concept.getStory({ user: "alice", story }).chapters[0]!;
  expect(first.question).toMatch(/why/i);
  expect(first.choices).toBeUndefined();
  expect(() => concept.getActivityChapter({ user: "alice", story })).toThrow(ActivityNotReached);
  const results = await Promise.allSettled([
    concept.continueStory({ user: "alice", story, answer: "the crowd because of their reactions", expectedChapter: chapter }),
    concept.continueStory({ user: "alice", story, answer: "a different answer", expectedChapter: chapter }),
  ]);
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect((results.find((result) => result.status === "rejected") as PromiseRejectedResult).reason).toBeInstanceOf(StaleStoryChapter);
  await expect(concept.continueStory({ user: "alice", story, answer: "replay", expectedChapter: chapter })).rejects.toBeInstanceOf(StaleStoryChapter);
  const second = concept.getStory({ user: "alice", story }).chapters;
  expect(second).toHaveLength(2);
  expect(second[0]!.answer).toBe("the crowd because of their reactions");
  expect(second[1]!.answer).toBeUndefined();
  expect(second[1]!.question).toMatch(/why/i);
  await concept.continueStory({ user: "alice", story, answer: "a close-up shows the detail", expectedChapter: second[1]!.chapter });
  const final = concept.getStory({ user: "alice", story }).chapters[2]!;
  expect(concept.getActivityChapter({ user: "alice", story })).toEqual({ chapter: final.chapter });
  expect(() => concept.getActivityChapter({ user: "bob", story })).toThrow(ActivityStoryNotFound);
  expect(final.question).toBeUndefined();
  expect(final.choices).toBeUndefined();
});

test("optional live choices are copied, persisted, and enforce exact trimmed membership", async () => {
  const offered = ["Use the bridge", "Take the shortcut"];
  const generator: StoryGenerator = { generateChapter: async () => ({ text: "The two routes lead to different islands.", question: "Which route will Alex take?", choices: offered }) };
  const concept = new StoryGenerationConcept(undefined, generator);
  const { story, chapter } = await start(concept);
  offered[0] = "mutated";
  const view = concept.getStory({ user: "alice", story });
  expect(view.chapters[0]!.choices).toEqual(["Use the bridge", "Take the shortcut"]);
  view.chapters[0]!.choices![0] = "another mutation";
  await expect(concept.continueStory({ user: "alice", story, answer: "other", expectedChapter: chapter })).rejects.toBeInstanceOf(InvalidStoryAnswer);
  const restored = new StoryGenerationConcept(undefined, new PreparedStoryGenerator());
  restored[RESTORE_STATE](concept[EXPORT_STATE]());
  await restored.continueStory({ user: "alice", story, answer: "  Use the bridge  ", expectedChapter: chapter });
  expect(restored.getStory({ user: "alice", story }).chapters[0]!.answer).toBe("Use the bridge");
});

test("malformed choices and choices attached to a why question fall back to a coherent prepared scene", async () => {
  for (const choices of [["one"], ["same", "same"], ["", "next"], ["x".repeat(201), "next"], "invalid", ["one", "two", "three", "four", "five"]]) {
    const concept = new StoryGenerationConcept(undefined, { generateChapter: async () => ({ text: "A live unrelated scene", question: "Choose a road?", choices } as never) });
    const { story } = await start(concept);
    const first = concept.getStory({ user: "alice", story }).chapters[0]!;
    expect(first.text).toContain("soccer pitch");
    expect(first.question).toBe("What would you photograph first, and why?");
    expect(first.choices).toBeUndefined();
  }
  const concept = new StoryGenerationConcept(undefined, { generateChapter: async () => ({ text: "live", question: "Why would you do that?", choices: ["yes", "no"] }) });
  const { story } = await start(concept);
  expect(concept.getStory({ user: "alice", story }).chapters[0]!.text).toContain("soccer pitch");
});

test("exact legacy migrations preserve identities, prose, order, and answered historical questions", () => {
  const concept = new StoryGenerationConcept(undefined, new PreparedStoryGenerator());
  for (const [old, current] of Object.entries(legacyPrompts)) {
    const state = {
      stories: [{ story: "story", user: "alice", activity: "Sports Photography", context: "context", chapters: ["answered", "unanswered"] }],
      chapters: [
        { chapter: "answered", story: "story", position: 1, text: "original first prose", question: old, choices: ["old A", "old B"], answer: "historically accepted value" },
        { chapter: "unanswered", story: "story", position: 2, text: "original second prose", question: old, choices: ["old A", "old B"] },
      ],
    };
    concept[RESTORE_STATE](state);
    const chapters = concept.getStory({ user: "alice", story: "story" }).chapters;
    expect(chapters[0]).toEqual(state.chapters[0]);
    expect(chapters[1]).toMatchObject({ chapter: "unanswered", story: "story", position: 2, text: "original second prose", question: current });
    expect(chapters[1]!.choices).toBeUndefined();
  }
  concept[RESTORE_STATE]({ stories: [{ story: "story", user: "alice", activity: "other", context: "", chapters: ["custom"] }], chapters: [{ chapter: "custom", story: "story", position: 1, text: "prose", question: "A custom live question?", choices: ["alpha", "beta"] }] });
  expect(concept.getStory({ user: "alice", story: "story" }).chapters[0]!.choices).toEqual(["alpha", "beta"]);
});

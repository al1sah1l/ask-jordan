
import {
  describe,
  expect,
  test,
} from "bun:test";

import {
  ProgressiveStoryEngine,
  ProgressiveStoryNotFound,
  StaleProgressiveChapter,
  type ProgressiveContentGenerator,
} from "../src/learning/ProgressiveStoryEngine.ts";

import {
  ChapterNotReady,
} from "../src/learning/ProgressiveChapter.ts";

const generator: ProgressiveContentGenerator = {
  async beginChapter(input) {
    return {
      theory: {
        topic:
          input.position === 1
            ? "Camera shots"
            : `Advanced filmmaking ${input.position}`,
        explanation:
          "Different camera shots communicate different information.",
        keyTerms: ["wide shot", "close-up"],
      },
      introduction:
        `Jordan begins chapter ${input.position}.`,
      firstQuestion: {
        prompt: "Which shot would you choose?",
        options: ["Wide shot", "Close-up"],
      },
    };
  },

  async afterFirstChoice(input) {
    return {
      scene:
        `Jordan tries ${input.answer} and sees the result.`,
      question: {
        prompt: "What should happen next?",
      },
    };
  },

  async afterSecondChoice(input) {
    return {
      conclusion:
        `Jordan finishes the scene after choosing ${input.answer}.`,
      practicalChallenge:
        "Record two camera shots with a phone.",
    };
  },
};

function makeEngine(
  savedPages = new Map<string, string>(),
) {
  return new ProgressiveStoryEngine(
    generator,
    async ({ user, story, chapter }) =>
      savedPages.get(
        JSON.stringify([user, story, chapter]),
      ) ?? null,
  );
}

async function start(engine: ProgressiveStoryEngine) {
  return engine.startStory({
    user: "george",
    activity: "filmmaking",
    context: "Enjoys movies.",
  });
}

async function finishChapter(
  engine: ProgressiveStoryEngine,
  story: string,
  chapter: string,
) {
  await engine.submitChoice({
    user: "george",
    story,
    chapter,
    answer: "Close-up",
    expectedStage: "first-choice",
  });

  return engine.submitChoice({
    user: "george",
    story,
    chapter,
    answer: "Change the angle",
    expectedStage: "second-choice",
  });
}

describe("Progressive Story Engine", () => {
  test("creates an educational first chapter", async () => {
    const engine = makeEngine();
    const { story } = await start(engine);

    const result = engine.getStory({
      user: "george",
      story,
    });

    expect(result.chapters).toHaveLength(1);
    expect(result.chapters[0]?.theory.topic).toBe(
      "Camera shots",
    );
    expect(result.chapters[0]?.stage).toBe(
      "first-choice",
    );
  });

  test("two choices stay inside the same chapter", async () => {
    const engine = makeEngine();
    const { story, chapter } = await start(engine);

    const result = await finishChapter(
      engine,
      story,
      chapter,
    );

    expect(result.chapter).toBe(chapter);
    expect(result.stage).toBe("awaiting-reflection");

    const saved = engine.getStory({
      user: "george",
      story,
    });

    expect(saved.chapters).toHaveLength(1);
    expect(saved.chapters[0]?.firstDecision?.answer)
      .toBe("Close-up");
    expect(saved.chapters[0]?.secondDecision?.answer)
      .toBe("Change the angle");
    expect(saved.chapters[0]?.practicalChallenge)
      .toBeTruthy();
  });

  test("refuses progression without saved reflection", async () => {
    const engine = makeEngine();
    const { story, chapter } = await start(engine);

    await finishChapter(engine, story, chapter);

    await expect(
      engine.nextChapter({ user: "george", story }),
    ).rejects.toBeInstanceOf(ChapterNotReady);

    await expect(
      engine.confirmSavedReflection({
        user: "george",
        story,
        chapter,
      }),
    ).rejects.toBeInstanceOf(ChapterNotReady);
  });

  test("saved reflection unlocks the next chapter", async () => {
    const pages = new Map<string, string>();
    const engine = makeEngine(pages);

    const { story, chapter } = await start(engine);

    await finishChapter(engine, story, chapter);

    pages.set(
      JSON.stringify(["george", story, chapter]),
      "reflection-page-one",
    );

    await engine.confirmSavedReflection({
      user: "george",
      story,
      chapter,
    });

    const next = await engine.nextChapter({
      user: "george",
      story,
    });

    expect(next.chapter).not.toBe(chapter);

    const result = engine.getStory({
      user: "george",
      story,
    });

    expect(result.chapters).toHaveLength(2);
    expect(result.chapters[0]?.stage).toBe(
      "reflected",
    );
    expect(result.chapters[1]?.position).toBe(2);
    expect(result.chapters[1]?.theory.topic).toBe(
      "Advanced filmmaking 2",
    );
  });

  test("prevents repeated choices", async () => {
    const engine = makeEngine();
    const { story, chapter } = await start(engine);

    await engine.submitChoice({
      user: "george",
      story,
      chapter,
      answer: "Wide shot",
      expectedStage: "first-choice",
    });

    await expect(
      engine.submitChoice({
        user: "george",
        story,
        chapter,
        answer: "Close-up",
        expectedStage: "first-choice",
      }),
    ).rejects.toBeInstanceOf(StaleProgressiveChapter);
  });

  test("prevents accessing someone else's story", async () => {
    const engine = makeEngine();
    const { story } = await start(engine);

    expect(() =>
      engine.getStory({
        user: "sarah",
        story,
      }),
    ).toThrow(ProgressiveStoryNotFound);
  });

  test("restores choices and progress from snapshot", async () => {
    const first = makeEngine();
    const { story, chapter } = await start(first);

    await first.submitChoice({
      user: "george",
      story,
      chapter,
      answer: "Wide shot",
      expectedStage: "first-choice",
    });

    const snapshot = JSON.parse(
      JSON.stringify(first.exportState()),
    );

    const restored = makeEngine();
    restored.restoreState(snapshot);

    const result = restored.getStory({
      user: "george",
      story,
    });

    expect(result.chapters[0]?.stage).toBe(
      "second-choice",
    );
    expect(result.chapters[0]?.firstDecision?.answer)
      .toBe("Wide shot");

    await restored.submitChoice({
      user: "george",
      story,
      chapter,
      answer: "Move closer",
      expectedStage: "second-choice",
    });

    expect(
      restored.getStory({
        user: "george",
        story,
      }).chapters[0]?.stage,
    ).toBe("awaiting-reflection");
  });
});

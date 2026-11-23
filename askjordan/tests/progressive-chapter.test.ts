
import {
  describe,
  expect,
  test,
} from "bun:test";

import {
  canStartNextChapter,
  ChapterNotReady,
  confirmChapterReflection,
  createProgressiveChapter,
  InvalidChapterChoice,
  InvalidChapterTransition,
  submitFirstChoice,
  submitSecondChoice,
  type ProgressiveChapter,
} from "../src/learning/ProgressiveChapter.ts";

function makeChapter(
  position = 1,
  previous?: ProgressiveChapter,
) {
  return createProgressiveChapter(
    {
      chapter: `chapter-${position}`,
      story: "filmmaking-story",
      position,
      theory: {
        topic:
          position === 1
            ? "Camera shots"
            : "Visual composition",
        explanation:
          position === 1
            ? "A close-up shows details and emotions."
            : "Composition determines how elements are arranged in a frame.",
        keyTerms:
          position === 1
            ? ["close-up", "wide shot"]
            : ["framing", "rule of thirds"],
      },
      introduction:
        "Jordan is preparing to film a scene.",
      firstQuestion: {
        prompt:
          "Which shot should Jordan choose?",
        options: [
          "Close-up",
          "Wide shot",
        ],
      },
    },
    previous,
  );
}

function finishChapter(
  chapter: ProgressiveChapter,
): ProgressiveChapter {
  const afterFirst = submitFirstChoice(
    chapter,
    "Close-up",
    "Jordan films the character's expression.",
    {
      prompt:
        "How should Jordan improve the scene?",
    },
  );

  return submitSecondChoice(
    afterFirst,
    "I would change the camera angle.",
    "Jordan completes the scene successfully.",
    "Film a 30-second scene using two camera angles.",
  );
}

describe("Progressive Chapter", () => {
  test("starts with theory and one interactive story", () => {
    const chapter = makeChapter();

    expect(chapter.position).toBe(1);
    expect(chapter.theory.topic).toBe(
      "Camera shots",
    );
    expect(chapter.theory.keyTerms).toContain(
      "close-up",
    );
    expect(chapter.stage).toBe("first-choice");
    expect(chapter.firstDecision).toBeUndefined();
  });

  test("two choices remain within one chapter", () => {
    const first = makeChapter();
    const finished = finishChapter(first);

    expect(finished.chapter).toBe(first.chapter);
    expect(finished.position).toBe(1);
    expect(finished.firstDecision?.answer).toBe(
      "Close-up",
    );
    expect(finished.secondDecision?.answer).toBe(
      "I would change the camera angle.",
    );
    expect(finished.conclusion).toBeDefined();
    expect(finished.practicalChallenge).toBeDefined();
    expect(finished.stage).toBe(
      "awaiting-reflection",
    );
  });

  test("validates offered answers", () => {
    const chapter = makeChapter();

    expect(() =>
      submitFirstChoice(
        chapter,
        "Invalid option",
        "A consequence",
        { prompt: "What next?" },
      ),
    ).toThrow(InvalidChapterChoice);

    expect(chapter.stage).toBe("first-choice");
  });

  test("cannot start another chapter before reflection", () => {
    const finished = finishChapter(makeChapter());

    expect(canStartNextChapter(finished)).toBe(false);

    expect(() =>
      makeChapter(2, finished),
    ).toThrow(ChapterNotReady);
  });

  test("reflection unlocks the next chapter", () => {
    const finished = finishChapter(makeChapter());

    const reflected = confirmChapterReflection(
      finished,
      "reflection-page-1",
    );

    expect(reflected.stage).toBe("reflected");
    expect(reflected.reflectionPage).toBe(
      "reflection-page-1",
    );
    expect(canStartNextChapter(reflected)).toBe(true);

    const second = makeChapter(2, reflected);

    expect(second.position).toBe(2);
    expect(second.theory.topic).toBe(
      "Visual composition",
    );
    expect(second.story).toBe(reflected.story);
  });

  test("does not allow duplicate choices", () => {
    const chapter = makeChapter();

    const advanced = submitFirstChoice(
      chapter,
      "Close-up",
      "Jordan captures an expression.",
      { prompt: "What happens next?" },
    );

    expect(() =>
      submitFirstChoice(
        advanced,
        "Wide shot",
        "Different result",
        { prompt: "Another question?" },
      ),
    ).toThrow(InvalidChapterTransition);
  });

  test("supports more than three chapters", () => {
    let previous: ProgressiveChapter | undefined;

    for (let position = 1; position <= 6; position++) {
      const chapter = makeChapter(position, previous);

      const finished = finishChapter(chapter);

      previous = confirmChapterReflection(
        finished,
        `reflection-page-${position}`,
      );
    }

    expect(previous?.position).toBe(6);
    expect(previous?.stage).toBe("reflected");
  });
});

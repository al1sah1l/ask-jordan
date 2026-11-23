
import { describe, expect, test } from "bun:test";

import {
  OpenAIProgressiveGenerator,
} from "../src/ai/OpenAIProgressiveGenerator.ts";

import {
  createProgressiveChapter,
} from "../src/learning/ProgressiveChapter.ts";

function response(value: unknown): Response {
  return new Response(
    JSON.stringify({
      status: "completed",
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: JSON.stringify(value),
            },
          ],
        },
      ],
    }),
    { status: 200 },
  );
}

const beginning = {
  theory: {
    topic: "Camera shots",
    explanation:
      "A close-up highlights details and emotions.",
    keyTerms: ["close-up", "wide shot"],
  },
  introduction:
    "Alex and Jordan prepare to film a school event.",
  firstQuestion: {
    prompt: "Which camera shot should Alex use?",
    options: ["Close-up", "Wide shot"],
  },
};

const middle = {
  scene:
    "Alex chooses a close-up and captures the expression.",
  question: {
    prompt: "How should Alex improve the shot?",
    options: null,
  },
};

const ending = {
  conclusion:
    "Alex changes the camera angle and finishes the scene.",
  practicalChallenge:
    "Record two 15-second scenes using different camera shots.",
};

function mock(value: unknown): typeof fetch {
  return (async () => response(value)) as unknown as typeof fetch;
}

function chapter() {
  return createProgressiveChapter({
    story: "story-1",
    chapter: "chapter-1",
    position: 1,
    theory: beginning.theory,
    introduction: beginning.introduction,
    firstQuestion: beginning.firstQuestion,
  });
}

describe("OpenAI Progressive Generator", () => {
  test("generates a theory and first decision", async () => {
    const generator = new OpenAIProgressiveGenerator({
      apiKey: "test-key",
      fetchFn: mock(beginning),
    });

    const result = await generator.beginChapter({
      activity: "Filmmaking",
      context: "Likes movies.",
      position: 1,
      previousChapters: [],
    });

    expect(result.theory.topic).toBe("Camera shots");
    expect(result.firstQuestion.options).toEqual([
      "Close-up",
      "Wide shot",
    ]);
  });

  test("generates the consequence of the first choice", async () => {
    const generator = new OpenAIProgressiveGenerator({
      apiKey: "test-key",
      fetchFn: mock(middle),
    });

    const result = await generator.afterFirstChoice({
      activity: "Filmmaking",
      chapter: chapter(),
      answer: "Close-up",
    });

    expect(result.scene).toContain("close-up");
    expect(result.question.options).toBeUndefined();
  });

  test("generates a conclusion and challenge", async () => {
    const generator = new OpenAIProgressiveGenerator({
      apiKey: "test-key",
      fetchFn: mock(ending),
    });

    const result = await generator.afterSecondChoice({
      activity: "Filmmaking",
      chapter: chapter(),
      answer: "Change the angle",
    });

    expect(result.conclusion).toContain("angle");
    expect(result.practicalChallenge).toContain("Record");
  });

  test("includes earlier chapters when generating the next one", async () => {
    let sentBody: any;

    const fetchFn = (async (
      _url: unknown,
      init?: RequestInit,
    ) => {
      sentBody = JSON.parse(String(init?.body));
      return response(beginning);
    }) as unknown as typeof fetch;

    const generator = new OpenAIProgressiveGenerator({
      apiKey: "test-key",
      fetchFn,
    });

    await generator.beginChapter({
      activity: "Filmmaking",
      context: "Likes photography.",
      position: 2,
      previousChapters: [chapter()],
    });

    const input = JSON.parse(sentBody.input);

    expect(input.chapterPosition).toBe(2);
    expect(input.previousChapters).toHaveLength(1);
    expect(input.previousChapters[0].theory.topic)
      .toBe("Camera shots");

    expect(sentBody.store).toBe(false);
    expect(sentBody.text.format.type)
      .toBe("json_schema");
  });

  test("retries malformed content once", async () => {
    let calls = 0;

    const fetchFn = (async () => {
      calls++;
      return response(
        calls === 1
          ? { ...beginning, theory: null }
          : beginning,
      );
    }) as unknown as typeof fetch;

    const generator = new OpenAIProgressiveGenerator({
      apiKey: "test-key",
      fetchFn,
    });

    const result = await generator.beginChapter({
      activity: "Filmmaking",
      context: "",
      position: 1,
      previousChapters: [],
    });

    expect(result.theory.topic).toBe("Camera shots");
    expect(calls).toBe(2);
  });

  test("does not retry HTTP authentication failures", async () => {
    let calls = 0;

    const fetchFn = (async () => {
      calls++;
      return new Response("Unauthorized", {
        status: 401,
      });
    }) as unknown as typeof fetch;

    const generator = new OpenAIProgressiveGenerator({
      apiKey: "test-key",
      fetchFn,
    });

    await expect(
      generator.beginChapter({
        activity: "Filmmaking",
        context: "",
        position: 1,
        previousChapters: [],
      }),
    ).rejects.toThrow("HTTP 401");

    expect(calls).toBe(1);
  });
});

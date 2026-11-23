
import {
  describe,
  expect,
  test,
} from "bun:test";

import {
  createProgressiveGenerator,
} from "../src/ai/createProgressiveGenerator.ts";

const beginning = {
  theory: {
    topic: "Camera shots",
    explanation:
      "A close-up emphasizes details.",
    keyTerms: ["close-up"],
  },
  introduction:
    "Alex and Jordan prepare to film a scene.",
  firstQuestion: {
    prompt: "Which shot should Alex use?",
    options: ["Close-up", "Wide shot"],
  },
};

describe("Progressive generator factory", () => {
  test("disabled mode refuses generation", async () => {
    const generator = createProgressiveGenerator({
      mode: "disabled",
    });

    await expect(
      generator.beginChapter({
        activity: "Filmmaking",
        context: "",
        position: 1,
        previousChapters: [],
      }),
    ).rejects.toThrow(
      "Progressive generation is disabled",
    );
  });

  test("live mode uses the OpenAI generator", async () => {
    let calls = 0;

    const fetchFn = (async () => {
      calls++;

      return new Response(
        JSON.stringify({
          status: "completed",
          output: [
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify(beginning),
                },
              ],
            },
          ],
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const generator = createProgressiveGenerator({
      mode: "live",
      apiKey: "test-key",
      fetchFn,
    });

    const result = await generator.beginChapter({
      activity: "Filmmaking",
      context: "",
      position: 1,
      previousChapters: [],
    });

    expect(result.theory.topic).toBe(
      "Camera shots",
    );
    expect(calls).toBe(1);
  });

  test("live mode requires an API key", () => {
    expect(() =>
      createProgressiveGenerator({
        mode: "live",
        apiKey: " ",
      }),
    ).toThrow("OPENAI_API_KEY");
  });

  test("rejects unknown modes", () => {
    expect(() =>
      createProgressiveGenerator({
        mode: "invalid",
      }),
    ).toThrow("PROGRESSIVE_GENERATION_MODE");
  });
});

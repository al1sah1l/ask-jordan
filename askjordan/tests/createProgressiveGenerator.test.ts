
import {
  describe,
  expect,
  test,
} from "bun:test";

import {
  createProgressiveGenerator,
} from "../src/ai/createProgressiveGenerator.ts";
import { ProgressiveStoryEngine } from "../src/learning/ProgressiveStoryEngine.ts";

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

for (const failure of ["outage", "timeout", "malformed output", "network error", "prepared", "no key"]) {
  test(`progressive story reaches its ending and restores after ${failure}`, async () => {
    let calls = 0;
    const generator = createProgressiveGenerator({
      mode: failure === "prepared" ? "prepared" : failure === "no key" ? "auto" : "live",
      apiKey: failure === "no key" ? "" : "fake",
      timeoutMs: 2,
      fetchFn: (async (_url: unknown, init?: RequestInit) => {
        calls++;
        if (failure === "timeout") return new Promise<Response>((_resolve, reject) => {
          init!.signal!.addEventListener("abort", () => reject(new Error("timed out")), { once: true });
        });
        if (failure === "network error") throw new TypeError("Failed to fetch");
        if (failure === "malformed output") return Response.json({ status: "completed", output: [] });
        return new Response("unavailable", { status: 503 });
      }) as typeof fetch,
    });
    let engine = new ProgressiveStoryEngine(generator, async () => "saved-reflection");
    const { story, chapter } = await engine.startStory({
      user: "student", activity: "Robotics — moving machines", context: "I enjoy puzzles.",
    });
    const restore = () => {
      const snapshot = JSON.parse(JSON.stringify(engine.exportState()));
      engine = new ProgressiveStoryEngine(generator, async () => "saved-reflection");
      engine.restoreState(snapshot);
      return engine.getStory({ user: "student", story });
    };
    expect(restore().chapters[0]!.introduction).toContain("I enjoy puzzles.");
    await engine.submitChoice({ user: "student", story, chapter, answer: "test one step", expectedStage: "first-choice" });
    expect(restore().chapters[0]!.firstDecision?.answer).toBe("test one step");
    await engine.submitChoice({ user: "student", story, chapter, answer: "check each square", expectedStage: "second-choice" });
    const saved = restore().chapters[0]!;
    expect(saved.stage).toBe("awaiting-reflection");
    expect(saved.secondDecision?.answer).toBe("check each square");
    expect(saved.conclusion).toContain("message arrives intact");
    expect(saved.practicalChallenge).toContain("4-by-4 grid");
    expect(saved.firstQuestion.options).toBeUndefined();
    await engine.confirmSavedReflection({ user: "student", story, chapter });
    await engine.nextChapter({ user: "student", story });
    expect(restore().chapters).toHaveLength(2);
    expect(restore().chapters[1]!.introduction).toContain("I enjoy puzzles.");
    if (failure === "prepared" || failure === "no key") expect(calls).toBe(0);
    else expect(calls).toBeGreaterThanOrEqual(4);
  });
}

test("a live opening can finish with prepared content when the model goes down", async () => {
  let calls = 0;
  const generator = createProgressiveGenerator({
    mode: "live", apiKey: "fake",
    fetchFn: (async () => {
      if (++calls > 1) return new Response("unavailable", { status: 503 });
      return Response.json({ status: "completed", output: [{ type: "message", content: [
        { type: "output_text", text: JSON.stringify(beginning) },
      ] }] });
    }) as unknown as typeof fetch,
  });
  const engine = new ProgressiveStoryEngine(generator, async () => null);
  const { story, chapter } = await engine.startStory({ user: "student", activity: "Filmmaking", context: "Movies" });
  expect(engine.getStory({ user: "student", story }).chapters[0]!.theory.topic).toBe("Camera shots");
  await engine.submitChoice({ user: "student", story, chapter, answer: "Close-up", expectedStage: "first-choice" });
  await engine.submitChoice({ user: "student", story, chapter, answer: "a close detail", expectedStage: "second-choice" });
  const result = engine.getStory({ user: "student", story }).chapters[0]!;
  expect(result.firstDecision?.answer).toBe("Close-up");
  expect(result.conclusion).toBeString();
  expect(result.practicalChallenge).toContain("three-shot");
});

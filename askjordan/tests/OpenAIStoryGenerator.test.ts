
import { describe, expect, test } from "bun:test";
import { OpenAIStoryGenerator } from "../src/ai/OpenAIStoryGenerator.ts";

type MockChapter = {
  text: string;
  question: string | null;
  suggestedActivity: string | null;
};

function responseWithChapter(chapter: MockChapter): Response {
  return new Response(
    JSON.stringify({
      status: "completed",
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: JSON.stringify(chapter),
            },
          ],
        },
      ],
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

function mockFetch(chapter: MockChapter): typeof fetch {
  const fn = async (): Promise<Response> =>
    responseWithChapter(chapter);

  return fn as unknown as typeof fetch;
}

function chapterOneInput() {
  return {
    position: 1 as const,
    activity: "Photography",
    context: "Likes soccer",
    previousChapters: [],
  };
}

function chapterThreeInput() {
  return {
    position: 3 as const,
    activity: "Photography",
    context: "Likes soccer",
    previousChapters: [
      {
        position: 1,
        text: "Jamie finds a camera.",
        question: "What should Jamie try?",
        answer: "Photograph soccer players.",
      },
      {
        position: 2,
        text: "Jamie photographs soccer players.",
        question: "What next?",
        answer: "Capture the moment someone kicks the ball.",
      },
    ],
  };
}

describe("OpenAIStoryGenerator", () => {
  test("generates a valid first chapter", async () => {
    const generator = new OpenAIStoryGenerator({
      apiKey: "test-key",
      fetchFn: mockFetch({
        text: "Jamie discovers a camera.",
        question: "What would you photograph?",
        suggestedActivity: null,
      }),
    });

    const result = await generator.generateChapter(
      chapterOneInput(),
    );

    expect(result.text).toBe("Jamie discovers a camera.");
    expect(result.question).toBe(
      "What would you photograph?",
    );
    expect(result.suggestedActivity).toBeUndefined();
  });

  test("generates a valid final chapter", async () => {
    const generator = new OpenAIStoryGenerator({
      apiKey: "test-key",
      fetchFn: mockFetch({
        text: "Jamie captures the perfect soccer moment.",
        question: null,
        suggestedActivity:
          "Take five action photographs using your phone.",
      }),
    });

    const result = await generator.generateChapter(
      chapterThreeInput(),
    );

    expect(result.question).toBeUndefined();
    expect(result.suggestedActivity).toBe(
      "Take five action photographs using your phone.",
    );
  });

  test("sends the correct API request", async () => {
    let requestBody: Record<string, unknown> | undefined;
    let requestUrl = "";

    const fn = async (
      input: string | URL | Request,
      init?: RequestInit,
    ): Promise<Response> => {
      requestUrl = String(input);

      requestBody = JSON.parse(
        String(init?.body),
      ) as Record<string, unknown>;

      return responseWithChapter({
        text: "Jamie takes a photograph.",
        question: "What should Jamie explore?",
        suggestedActivity: null,
      });
    };

    const generator = new OpenAIStoryGenerator({
      apiKey: "test-key",
      fetchFn: fn as unknown as typeof fetch,
    });

    await generator.generateChapter(chapterOneInput());

    expect(requestUrl).toBe(
      "https://api.openai.com/v1/responses",
    );
    expect(requestBody?.model).toBe("gpt-4.1-mini");
    expect(requestBody?.store).toBe(false);
    expect(requestBody?.max_output_tokens).toBe(800);
    expect(requestBody?.text).toMatchObject({
      format: {
        type: "json_schema",
        name: "story_chapter",
        strict: true,
      },
    });
  });

  test("does not retry HTTP authentication errors", async () => {
    let calls = 0;

    const fn = async (): Promise<Response> => {
      calls++;

      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401 },
      );
    };

    const generator = new OpenAIStoryGenerator({
      apiKey: "test-key",
      fetchFn: fn as unknown as typeof fetch,
    });

    await expect(
      generator.generateChapter(chapterOneInput()),
    ).rejects.toThrow("HTTP 401");

    expect(calls).toBe(1);
  });

  test("removes a repeated question from the narrative", async () => {
    const question =
      "Should Jamie photograph the soccer players?";

    const generator = new OpenAIStoryGenerator({
      apiKey: "test-key",
      fetchFn: mockFetch({
        text:
          "Jamie reaches the soccer field. " +
          "Which players should Jamie photograph?",
        question,
        suggestedActivity: null,
      }),
    });

    const result = await generator.generateChapter(
      chapterOneInput(),
    );

    expect(result.text).toBe(
      "Jamie reaches the soccer field.",
    );

    expect(result.question).toBe(question);
    expect(result.text).not.toContain("?");
  });

  test("retries an invalid final chapter once", async () => {
    let calls = 0;

    const fn = async (): Promise<Response> => {
      calls++;

      if (calls === 1) {
        return responseWithChapter({
          text: "Jamie finishes the story.",
          question: null,
          suggestedActivity: null,
        });
      }

      return responseWithChapter({
        text: "Jamie captures a great action shot.",
        question: null,
        suggestedActivity:
          "Take three action photos with a smartphone.",
      });
    };

    const generator = new OpenAIStoryGenerator({
      apiKey: "test-key",
      fetchFn: fn as unknown as typeof fetch,
    });

    const result = await generator.generateChapter(
      chapterThreeInput(),
    );

    expect(calls).toBe(2);
    expect(result.suggestedActivity).toBe(
      "Take three action photos with a smartphone.",
    );
  });

  test("fails after two invalid final chapters", async () => {
    let calls = 0;

    const fn = async (): Promise<Response> => {
      calls++;

      return responseWithChapter({
        text: "Jamie finishes the story.",
        question: null,
        suggestedActivity: null,
      });
    };

    const generator = new OpenAIStoryGenerator({
      apiKey: "test-key",
      fetchFn: fn as unknown as typeof fetch,
    });

    await expect(
      generator.generateChapter(chapterThreeInput()),
    ).rejects.toThrow(
      "Chapter 3 is missing a valid suggestedActivity",
    );

    expect(calls).toBe(2);
  });

  test("retries a missing first-chapter question", async () => {
    let calls = 0;

    const fn = async (): Promise<Response> => {
      calls++;

      return responseWithChapter({
        text: "Jamie starts exploring photography.",
        question:
          calls === 1
            ? null
            : "What should Jamie photograph?",
        suggestedActivity: null,
      });
    };

    const generator = new OpenAIStoryGenerator({
      apiKey: "test-key",
      fetchFn: fn as unknown as typeof fetch,
    });

    const result = await generator.generateChapter(
      chapterOneInput(),
    );

    expect(calls).toBe(2);
    expect(result.question).toBe(
      "What should Jamie photograph?",
    );
  });
});

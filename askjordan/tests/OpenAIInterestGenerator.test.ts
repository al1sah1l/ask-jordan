
import { describe, expect, test } from "bun:test";

import { OpenAIInterestGenerator } from "../src/ai/OpenAIInterestGenerator.ts";

import type {
  InterestGenerationInput,
} from "../src/ai/InterestGenerator.ts";

function input(): InterestGenerationInput {
  return {
    preferences: [
      { subject: "music", status: "interested" },
    ],
    candidates: [
      {
        activity: "songwriting",
        name: "Songwriting",
        description: "Writing songs",
        relevanceScore: 3,
      },
      {
        activity: "photography",
        name: "Photography",
        description: "Taking photos",
        relevanceScore: 0,
      },
      {
        activity: "film",
        name: "Filmmaking",
        description: "Making short videos",
        relevanceScore: 0,
      },
    ],
    connections: [
      { first: "music", second: "songwriting" },
    ],
    limit: 3,
  };
}

function responseWithIds(ids: unknown): Response {
  return new Response(
    JSON.stringify({
      status: "completed",
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: JSON.stringify({ activityIds: ids }),
            },
          ],
        },
      ],
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
}

function mockFetch(ids: unknown): typeof fetch {
  const fn = async (): Promise<Response> =>
    responseWithIds(ids);

  return fn as unknown as typeof fetch;
}

describe("OpenAIInterestGenerator", () => {
  test("returns valid catalog Activity IDs", async () => {
    const generator = new OpenAIInterestGenerator({
      apiKey: "test-key",
      fetchFn: mockFetch([
        "songwriting",
        "photography",
        "film",
      ]),
    });

    const result = await generator.recommendActivities(
      input(),
    );

    expect(result).toEqual([
      "songwriting",
      "photography",
      "film",
    ]);
  });

  test("rejects invented activity IDs", async () => {
    const generator = new OpenAIInterestGenerator({
      apiKey: "test-key",
      fetchFn: mockFetch([
        "songwriting",
        "photography",
        "invented",
      ]),
    });

    await expect(
      generator.recommendActivities(input()),
    ).rejects.toThrow("unknown Activity IDs");
  });

  test("rejects duplicate activity IDs", async () => {
    const generator = new OpenAIInterestGenerator({
      apiKey: "test-key",
      fetchFn: mockFetch([
        "songwriting",
        "songwriting",
        "film",
      ]),
    });

    await expect(
      generator.recommendActivities(input()),
    ).rejects.toThrow("duplicate or unknown");
  });

  test("rejects incomplete recommendation lists", async () => {
    const generator = new OpenAIInterestGenerator({
      apiKey: "test-key",
      fetchFn: mockFetch(["songwriting"]),
    });

    await expect(
      generator.recommendActivities(input()),
    ).rejects.toThrow("Invalid activityIds array");
  });

  test("sends structured-output configuration", async () => {
    let requestBody: Record<string, unknown> | undefined;
    let requestUrl = "";

    const fn = async (
      url: string | URL | Request,
      init?: RequestInit,
    ): Promise<Response> => {
      requestUrl = String(url);
      requestBody = JSON.parse(
        String(init?.body),
      ) as Record<string, unknown>;

      return responseWithIds([
        "songwriting",
        "photography",
        "film",
      ]);
    };

    const generator = new OpenAIInterestGenerator({
      apiKey: "test-key",
      fetchFn: fn as unknown as typeof fetch,
    });

    await generator.recommendActivities(input());

    expect(requestUrl).toBe(
      "https://api.openai.com/v1/responses",
    );
    expect(requestBody?.model).toBe("gpt-4.1-mini");
    expect(requestBody?.store).toBe(false);

    expect(requestBody?.text).toMatchObject({
      format: {
        type: "json_schema",
        name: "activity_recommendations",
        strict: true,
      },
    });
  });

  test("rejects HTTP errors", async () => {
    const fn = async (): Promise<Response> =>
      new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401 },
      );

    const generator = new OpenAIInterestGenerator({
      apiKey: "test-key",
      fetchFn: fn as unknown as typeof fetch,
    });

    await expect(
      generator.recommendActivities(input()),
    ).rejects.toThrow("HTTP 401");
  });

  test("returns empty results for an empty catalog", async () => {
    let calls = 0;

    const fn = async (): Promise<Response> => {
      calls++;
      return responseWithIds([]);
    };

    const generator = new OpenAIInterestGenerator({
      apiKey: "test-key",
      fetchFn: fn as unknown as typeof fetch,
    });

    const result = await generator.recommendActivities({
      ...input(),
      candidates: [],
      limit: 0,
    });

    expect(result).toEqual([]);
    expect(calls).toBe(0);
  });
});

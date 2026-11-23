
import { OpenAIProgressiveGenerator } from "./OpenAIProgressiveGenerator.ts";
import type { ProgressiveContentGenerator } from "../learning/ProgressiveStoryEngine.ts";

export type ProgressiveGenerationMode = "disabled" | "live";

type Options = {
  mode?: string;
  apiKey?: string;
  model?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
};

const disabledGenerator: ProgressiveContentGenerator = {
  async beginChapter() {
    throw new Error("Progressive generation is disabled.");
  },

  async afterFirstChoice() {
    throw new Error("Progressive generation is disabled.");
  },

  async afterSecondChoice() {
    throw new Error("Progressive generation is disabled.");
  },
};

export function createProgressiveGenerator(
  options: Options = {},
): ProgressiveContentGenerator {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  const mode = options.mode ??
    process.env.PROGRESSIVE_GENERATION_MODE ??
    (apiKey?.trim() ? "live" : "disabled");

  if (mode === "disabled") return disabledGenerator;

  if (mode !== "live") {
    throw new Error("PROGRESSIVE_GENERATION_MODE must be disabled or live.");
  }

  if (!apiKey?.trim()) {
    throw new Error("OPENAI_API_KEY is required for live progressive generation.");
  }

  return new OpenAIProgressiveGenerator({
    apiKey,
    model: options.model,
    fetchFn: options.fetchFn,
    timeoutMs: options.timeoutMs,
  });
}

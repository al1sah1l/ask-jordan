
import { OpenAIProgressiveGenerator } from "./OpenAIProgressiveGenerator.ts";
import { PreparedProgressiveGenerator } from "./PreparedProgressiveGenerator.ts";
import type { ProgressiveContentGenerator } from "../learning/ProgressiveStoryEngine.ts";

export type ProgressiveGenerationMode = "auto" | "prepared" | "disabled" | "live";

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
    (process.env.STORY_GENERATION_MODE === "prepared" ? "prepared" : "auto");

  if (mode === "disabled") return disabledGenerator;

  if (!["auto", "prepared", "live"].includes(mode)) {
    throw new Error("PROGRESSIVE_GENERATION_MODE must be auto, prepared, disabled, or live.");
  }

  const prepared = new PreparedProgressiveGenerator();
  if (mode === "prepared" || (mode === "auto" && !apiKey?.trim())) return prepared;

  if (!apiKey?.trim()) {
    throw new Error("OPENAI_API_KEY is required for live progressive generation.");
  }

  const live = new OpenAIProgressiveGenerator({
    apiKey,
    model: options.model,
    fetchFn: options.fetchFn,
    timeoutMs: options.timeoutMs,
  });

  // Every phase can recover independently, including an outage after a live opening.
  return {
    async beginChapter(input) {
      try { return await live.beginChapter(input); }
      catch { return prepared.beginChapter(input); }
    },
    async afterFirstChoice(input) {
      try { return await live.afterFirstChoice(input); }
      catch { return prepared.afterFirstChoice(input); }
    },
    async afterSecondChoice(input) {
      try { return await live.afterSecondChoice(input); }
      catch { return prepared.afterSecondChoice(input); }
    },
  };
}

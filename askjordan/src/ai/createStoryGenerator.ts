import { OpenAIStoryGenerator } from "./OpenAIStoryGenerator.ts";
import { PreparedStoryGenerator } from "./PreparedStoryGenerator.ts";
import type { StoryGenerator } from "./StoryGenerator.ts";

export type StoryGenerationMode = "auto" | "live" | "prepared";

/** Resolve configuration when an application is assembled, not at module import. */
export function createStoryGenerator(options: {
  mode?: string;
  apiKey?: string;
  model?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
} = {}): StoryGenerator {
  const mode = options.mode ?? process.env.STORY_GENERATION_MODE ?? "auto";
  if (!["auto", "live", "prepared"].includes(mode)) {
    throw new Error("STORY_GENERATION_MODE must be auto, live, or prepared.");
  }
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  if (mode === "prepared" || (mode === "auto" && !apiKey?.trim())) {
    return new PreparedStoryGenerator();
  }
  return new OpenAIStoryGenerator({ ...options, apiKey });
}

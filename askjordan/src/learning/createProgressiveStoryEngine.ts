
import type {
  ReflectingConcept,
} from "../concepts/Reflecting.ts";

import {
  createProgressiveGenerator,
} from "../ai/createProgressiveGenerator.ts";

import {
  ProgressiveStoryEngine,
  type ProgressiveContentGenerator,
} from "./ProgressiveStoryEngine.ts";

export function createProgressiveStoryEngine(
  reflecting: ReflectingConcept,
  generator?: ProgressiveContentGenerator,
): ProgressiveStoryEngine {
  const contentGenerator =
    generator ?? createProgressiveGenerator();

  return new ProgressiveStoryEngine(
    contentGenerator,

    async ({ user, story, chapter }) => {
      const { entry } = await reflecting.get({
        user,
        story,
        chapter,
      });

      return entry?.page ?? null;
    },
  );
}

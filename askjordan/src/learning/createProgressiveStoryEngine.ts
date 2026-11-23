
import type { ReflectingConcept } from "../concepts/Reflecting.ts";

import {
  ProgressiveStoryEngine,
  type ProgressiveContentGenerator,
} from "./ProgressiveStoryEngine.ts";

const unavailableGenerator: ProgressiveContentGenerator = {
  async beginChapter() {
    throw new Error(
      "Progressive content generation is not configured.",
    );
  },

  async afterFirstChoice() {
    throw new Error(
      "Progressive content generation is not configured.",
    );
  },

  async afterSecondChoice() {
    throw new Error(
      "Progressive content generation is not configured.",
    );
  },
};

export function createProgressiveStoryEngine(
  reflecting: ReflectingConcept,
  generator: ProgressiveContentGenerator =
    unavailableGenerator,
): ProgressiveStoryEngine {
  return new ProgressiveStoryEngine(
    generator,

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

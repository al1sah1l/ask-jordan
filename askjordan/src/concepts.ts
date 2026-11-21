
import { conceptSet } from "@mit-sdg/sync-engine/assembly";

import { interestCollection } from "./concepts/InterestCollection.registry.ts";
import { explorationTracking } from "./concepts/ExplorationTracking.registry.ts";
import { interestGeneration } from "./concepts/InterestGeneration.registry.ts";
import { storyGeneration } from "./concepts/StoryGeneration.registry.ts";

export const applicationConceptSet = conceptSet({
  InterestCollection: interestCollection,
  ExplorationTracking: explorationTracking,
  InterestGeneration: interestGeneration,
  StoryGeneration: storyGeneration,
});

export const { concepts } = applicationConceptSet;

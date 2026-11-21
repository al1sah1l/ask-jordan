
import { conceptSet } from "@mit-sdg/sync-engine/assembly";

import { interestCollection } from "./concepts/InterestCollection.registry.ts";
import { explorationTracking } from "./concepts/ExplorationTracking.registry.ts";

export const applicationConceptSet = conceptSet({
  InterestCollection: interestCollection,
  ExplorationTracking: explorationTracking,
});

export const { concepts } = applicationConceptSet;

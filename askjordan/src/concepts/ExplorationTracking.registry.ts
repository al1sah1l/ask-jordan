
import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import spec from "@design/concepts/ExplorationTracking.md" with { type: "text" };

import {
  ExplorationTrackingConcept,
  ExplorationAlreadyStarted,
  ExplorationNotStarted,
} from "./ExplorationTracking.ts";

export const explorationTracking = registerConcept({
  class: ExplorationTrackingConcept,
  spec,
  refusals: {
    EXPLORATION_ALREADY_STARTED: ExplorationAlreadyStarted,
    EXPLORATION_NOT_STARTED: ExplorationNotStarted,
  },
});


import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import spec from "@design/concepts/InterestGeneration.md" with { type: "text" };

import {
  InterestGenerationConcept,
  NoActivitiesAvailable,
  SuggestionNotFound,
} from "./InterestGeneration.ts";

export const interestGeneration = registerConcept({
  class: InterestGenerationConcept,
  spec,
  refusals: {
    NO_ACTIVITIES_AVAILABLE: NoActivitiesAvailable,
    SUGGESTION_NOT_FOUND: SuggestionNotFound,
  },
});

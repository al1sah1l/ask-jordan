
import {
  assemble,
  type ImplementationOverrides,
} from "@mit-sdg/sync-engine/assembly";

import { applicationConceptSet } from "./concepts.ts";

import {
  composition as explorationComposition,
} from "./compositions/ExplorationFlow.ts";

export type AskJordanOverrides =
  ImplementationOverrides<typeof applicationConceptSet>;

export function assembleApplication(
  instances: AskJordanOverrides = {},
) {
  return assemble({
    conceptSet: applicationConceptSet,

    instances: {
      ...applicationConceptSet.implementations(),
      ...instances,
    },

    composition: {
      AskJordan: explorationComposition,
    },
  });
}

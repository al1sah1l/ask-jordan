
import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import spec from "@design/concepts/InterestCollection.md" with { type: "text" };

import {
  InterestCollectionConcept,
  InvalidCatalogEntry,
  CatalogEntryExists,
  CatalogEntryNotFound,
  ConnectionExists,
  InvalidPreference,
} from "./InterestCollection.ts";

export const interestCollection = registerConcept({
  class: InterestCollectionConcept,
  spec,
  refusals: {
    INVALID_CATALOG_ENTRY: InvalidCatalogEntry,
    CATALOG_ENTRY_EXISTS: CatalogEntryExists,
    CATALOG_ENTRY_NOT_FOUND: CatalogEntryNotFound,
    CONNECTION_EXISTS: ConnectionExists,
    INVALID_PREFERENCE: InvalidPreference,
  },
});

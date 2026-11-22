import { assemble } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import { composition as sessions } from "./compositions/Sessions.ts";
import { AccountConcept } from "./concepts/Account.ts";
import { AuthenticatingConcept } from "./concepts/Authenticating.ts";
import { AvatarCustomizingConcept } from "./concepts/AvatarCustomizing.ts";
import { ExplorationTrackingConcept } from "./concepts/ExplorationTracking.ts";
import { InterestCollectionConcept } from "./concepts/InterestCollection.ts";
import { InterestGenerationConcept } from "./concepts/InterestGeneration.ts";
import { SessioningConcept } from "./concepts/Sessioning.ts";
import { StoryGenerationConcept } from "./concepts/StoryGeneration.ts";
import { applicationConceptSet } from "./concepts.ts";
import { db } from "./db.ts";

/** Tests pass their own throwaway database and, for Sessioning, a clock they can move. */
export function assembleApplication(database: Db = db, clock: () => Date = () => new Date()) {
  return assemble({
    conceptSet: applicationConceptSet,
    instances: {
      Authenticating: new AuthenticatingConcept(database),
      Sessioning: new SessioningConcept(database, clock),
      Account: new AccountConcept(database),
      AvatarCustomizing: new AvatarCustomizingConcept(database),
      InterestCollection: new InterestCollectionConcept(),
      ExplorationTracking: new ExplorationTrackingConcept(),
      InterestGeneration: new InterestGenerationConcept(),
      StoryGeneration: new StoryGenerationConcept(),
    },
    composition: {
      Sessions: sessions,
    },
  });
}

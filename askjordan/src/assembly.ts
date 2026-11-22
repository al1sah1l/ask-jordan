
import { assemble } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";

import { composition as accounts } from "./compositions/Accounts.ts";
import { composition as sessions } from "./compositions/Sessions.ts";
import { composition as explorationComposition } from "./compositions/ExplorationFlow.ts";
import { composition as interestApi } from "./compositions/InterestApi.ts";

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

export type AskJordanOverrides = Partial<{
  Authenticating: AuthenticatingConcept;
  Sessioning: SessioningConcept;
  Account: AccountConcept;
  AvatarCustomizing: AvatarCustomizingConcept;
  InterestCollection: InterestCollectionConcept;
  ExplorationTracking: ExplorationTrackingConcept;
  InterestGeneration: InterestGenerationConcept;
  StoryGeneration: StoryGenerationConcept;
}>;

/**
 * Supports production MongoDB instances, test databases,
 * and mock concept implementations.
 */
export function assembleApplication(
  databaseOrOverrides: Db | AskJordanOverrides = db,
  clock: () => Date = () => new Date(),
  testOverrides: AskJordanOverrides = {},
) {
  const isDatabase =
    "collection" in databaseOrOverrides &&
    typeof databaseOrOverrides.collection === "function";

  const database = isDatabase
    ? (databaseOrOverrides as Db)
    : db;

  const overrides: AskJordanOverrides = {
    ...(isDatabase
      ? {}
      : (databaseOrOverrides as AskJordanOverrides)),
    ...testOverrides,
  };

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

      ...overrides,
    },

    composition: {
      Sessions: sessions,
      Accounts: accounts,
      AskJordan: explorationComposition,
      InterestApi: interestApi,
    },
  });
}

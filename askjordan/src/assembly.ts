
import { assemble } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";

import { composition as accounts } from "./compositions/Accounts.ts";
import { composition as sessions } from "./compositions/Sessions.ts";
import { composition as explorationComposition } from "./compositions/ExplorationFlow.ts";
import { composition as interestApi } from "./compositions/InterestApi.ts";
import { composition as reflectingComposition } from "./compositions/Reflecting.ts";

import { AccountConcept } from "./concepts/Account.ts";
import { AuthenticatingConcept } from "./concepts/Authenticating.ts";
import { AvatarCustomizingConcept } from "./concepts/AvatarCustomizing.ts";
import { ExplorationTrackingConcept } from "./concepts/ExplorationTracking.ts";
import {
  InterestCollectionConcept,
  CatalogEntryNotFound,
} from "./concepts/InterestCollection.ts";
import { InterestGenerationConcept } from "./concepts/InterestGeneration.ts";
import { SessioningConcept } from "./concepts/Sessioning.ts";
import { StoryGenerationConcept } from "./concepts/StoryGeneration.ts";

import { ReflectingConcept } from "./concepts/Reflecting.ts";

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
  Reflecting: ReflectingConcept;
}>;

export type PersistableConcepts = {
  interests: InterestCollectionConcept;
  stories: StoryGenerationConcept;
  explorations: ExplorationTrackingConcept;
};

/**
 * Each assembled application has its own concept instances.
 * WeakMap lets persistence access the underlying instances
 * without going through the sync-engine action proxy.
 */
const persistenceInstances = new WeakMap<
  object,
  PersistableConcepts
>();

export function getPersistenceConcepts(
  application: object,
): PersistableConcepts {
  const instances = persistenceInstances.get(application);

  if (!instances) {
    throw new Error(
      "Persistence concepts are unavailable for this application.",
    );
  }

  return instances;
}

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

  const interestCollection =
    overrides.InterestCollection ??
    new InterestCollectionConcept();

  const storyGeneration =
    overrides.StoryGeneration ??
    new StoryGenerationConcept(
      undefined,
      undefined,
      (activityId) => {
        const activity = interestCollection
          ._activities({})
          .find((item) => item.activity === activityId);

        if (!activity) {
          throw new CatalogEntryNotFound(
            "The selected activity does not exist.",
          );
        }

        return `${activity.name} — ${activity.description}`;
      },
    );

  const explorationTracking =
    overrides.ExplorationTracking ??
    new ExplorationTrackingConcept();

  const application = assemble({
    conceptSet: applicationConceptSet,

    instances: {
      Authenticating:
        overrides.Authenticating ??
        new AuthenticatingConcept(database),

      Sessioning:
        overrides.Sessioning ??
        new SessioningConcept(database, clock),

      Account:
        overrides.Account ??
        new AccountConcept(database),

      AvatarCustomizing:
        overrides.AvatarCustomizing ??
        new AvatarCustomizingConcept(database),

      InterestCollection: interestCollection,
      ExplorationTracking: explorationTracking,

      InterestGeneration:
        overrides.InterestGeneration ??
        new InterestGenerationConcept(),

      StoryGeneration: storyGeneration,
      Reflecting: overrides.Reflecting ?? new ReflectingConcept(database),
    },

    composition: {
      Sessions: sessions,
      Accounts: accounts,
      AskJordan: explorationComposition,
      InterestApi: interestApi,
      Reflecting: reflectingComposition,
    },
  });

  persistenceInstances.set(application, {
    interests: interestCollection,
    stories: storyGeneration,
    explorations: explorationTracking,
  });

  return application;
}

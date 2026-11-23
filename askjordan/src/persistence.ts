
import type { Db } from "mongodb";

import {
  getPersistenceConcepts,
  type assembleApplication,
} from "./assembly.ts";

import {
  EXPORT_STATE,
  RESTORE_STATE,
} from "./persistence-symbols.ts";

import type {
  InterestCollectionState,
} from "./concepts/InterestCollection.ts";

import type {
  StoryGenerationState,
} from "./concepts/StoryGeneration.ts";

import type {
  ExplorationTrackingState,
} from "./concepts/ExplorationTracking.ts";

type Application = ReturnType<typeof assembleApplication>;

type StoredState = {
  _id: string;
  version: 1;
  interests: InterestCollectionState;
  stories: StoryGenerationState;
  explorations: ExplorationTrackingState;
};

const DOCUMENT_ID = "ask-jordan-state";

export class ApplicationPersistence {
  private pending: Promise<void> = Promise.resolve();

  constructor(private readonly database: Db) {}

  async restore(
    application: Application,
  ): Promise<boolean> {
    const saved = await this.database
      .collection<StoredState>("application.state")
      .findOne({ _id: DOCUMENT_ID });

    if (!saved) return false;

    if (saved.version !== 1) {
      throw new Error(
        "Unsupported application state version.",
      );
    }

    const concepts = getPersistenceConcepts(application);

    concepts.interests[RESTORE_STATE](saved.interests);
    concepts.stories[RESTORE_STATE](saved.stories);
    concepts.explorations[RESTORE_STATE](
      saved.explorations,
    );

    return true;
  }

  save(application: Application): Promise<void> {
    const concepts = getPersistenceConcepts(application);

    const snapshot: StoredState = {
      _id: DOCUMENT_ID,
      version: 1,
      interests: concepts.interests[EXPORT_STATE](),
      stories: concepts.stories[EXPORT_STATE](),
      explorations: concepts.explorations[EXPORT_STATE](),
    };

    const operation = this.pending
      .catch(() => {
        // Allow a new save after an earlier failure.
      })
      .then(async () => {
        await this.database
          .collection<StoredState>("application.state")
          .replaceOne(
            { _id: DOCUMENT_ID },
            snapshot,
            { upsert: true },
          );
      });

    this.pending = operation;

    return operation;
  }
}

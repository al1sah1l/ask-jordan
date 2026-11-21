import { conceptSet, registerConcept } from "@mit-sdg/sync-engine/assembly";
import accountSpec from "@design/concepts/Account.md" with { type: "text" };
import authenticatingSpec from "@design/concepts/Authenticating.md" with { type: "text" };
import avatarSpec from "@design/concepts/AvatarCustomizing.md" with { type: "text" };
import sessioningSpec from "@design/concepts/Sessioning.md" with { type: "text" };
import { AccountConcept, BlankName, NoProfile, ProfileExists } from "./concepts/Account.ts";
import {
  AuthenticatingConcept,
  InvalidCredentials,
  InvalidUsername,
  UsernameTaken,
  WeakPassword,
} from "./concepts/Authenticating.ts";
import {
  AlreadyHolds,
  AvatarCustomizingConcept,
  InvalidSlot,
  NoHoldings,
  NotHolding,
  NotWearing,
} from "./concepts/AvatarCustomizing.ts";
import { explorationTracking } from "./concepts/ExplorationTracking.registry.ts";
import { interestCollection } from "./concepts/InterestCollection.registry.ts";
import { interestGeneration } from "./concepts/InterestGeneration.registry.ts";
import { SessioningConcept, UnknownSession } from "./concepts/Sessioning.ts";
import { storyGeneration } from "./concepts/StoryGeneration.registry.ts";

const authenticating = registerConcept({
  class: AuthenticatingConcept,
  spec: authenticatingSpec,
  refusals: {
    INVALID_USERNAME: InvalidUsername,
    WEAK_PASSWORD: WeakPassword,
    USERNAME_TAKEN: UsernameTaken,
    INVALID_CREDENTIALS: InvalidCredentials,
  },
});

const sessioning = registerConcept({
  class: SessioningConcept,
  spec: sessioningSpec,
  refusals: { UNKNOWN_SESSION: UnknownSession },
});

const account = registerConcept({
  class: AccountConcept,
  spec: accountSpec,
  refusals: {
    BLANK_NAME: BlankName,
    PROFILE_EXISTS: ProfileExists,
    NO_PROFILE: NoProfile,
  },
});

const avatarCustomizing = registerConcept({
  class: AvatarCustomizingConcept,
  spec: avatarSpec,
  refusals: {
    ALREADY_HOLDS: AlreadyHolds,
    INVALID_SLOT: InvalidSlot,
    NOT_HOLDING: NotHolding,
    NOT_WEARING: NotWearing,
    NO_HOLDINGS: NoHoldings,
  },
});

export const applicationConceptSet = conceptSet({
  Authenticating: authenticating,
  Sessioning: sessioning,
  Account: account,
  AvatarCustomizing: avatarCustomizing,
  InterestCollection: interestCollection,
  ExplorationTracking: explorationTracking,
  InterestGeneration: interestGeneration,
  StoryGeneration: storyGeneration,
});
export const { concepts } = applicationConceptSet;


import {
  reaction,
  when,
} from "@mit-sdg/sync-engine/language";

import { concepts } from "../concepts.ts";

const {
  StoryGeneration,
  ExplorationTracking,
} = concepts;

const StoryCreatedStartsExploration = reaction(
  ({ user, story }) =>
    when(
      StoryGeneration.generateStory({
        user,
      }).responds({
        story,
      }),
    ).then(
      ExplorationTracking.startExploration({
        user,
        story,
      }),
    ),
);

export const composition = {
  StoryExploration: {
    StoryCreatedStartsExploration,
  },
};

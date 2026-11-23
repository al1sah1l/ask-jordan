
import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import spec from "@design/concepts/StoryGeneration.md" with { type: "text" };

import {
  StoryGenerationConcept,
  StoryAlreadyExists,
  StoryNotFound,
  InvalidStoryAnswer,
  StoryCannotContinue,
  StaleStoryChapter,
  GetStoryNotFound,
  ActivityStoryNotFound,
  ActivityNotReached,
} from "./StoryGeneration.ts";

export const storyGeneration = registerConcept({
  class: StoryGenerationConcept,
  spec,
  refusals: {
    STORY_ALREADY_EXISTS: StoryAlreadyExists,
    STORY_NOT_FOUND: StoryNotFound,
    INVALID_STORY_ANSWER: InvalidStoryAnswer,
    STORY_CANNOT_CONTINUE: StoryCannotContinue,
    STALE_STORY_CHAPTER: StaleStoryChapter,
    GET_STORY_NOT_FOUND: GetStoryNotFound,
    ACTIVITY_STORY_NOT_FOUND: ActivityStoryNotFound,
    ACTIVITY_NOT_REACHED: ActivityNotReached,
  },
});

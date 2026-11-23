import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import spec from "@design/concepts/Reflecting.md" with { type: "text" };

import {
  InvalidStoryOrChapter,
  JournalAlreadyExists,
  NoEntry,
  NoJournalFound,
  NoPageFound,
  NoStoryFound,
  PageAlreadyExists,
  ReflectingConcept,
} from "./Reflecting.ts";

export const reflecting = registerConcept({
  class: ReflectingConcept,
  spec,
  refusals: {
    JOURNAL_CREATED: JournalAlreadyExists,
    NO_JOURNAL_FOUND: NoJournalFound,
    INVALID_STORY_OR_CHAPTER: InvalidStoryOrChapter,
    NOT_ABLE_TO_WRITE: PageAlreadyExists,
    NO_ENTRY: NoEntry,
    NO_PAGE_FOUND: NoPageFound,
    NO_STORY_FOUND: NoStoryFound,
  },
});

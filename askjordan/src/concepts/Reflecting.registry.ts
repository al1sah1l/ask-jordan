import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import spec from "@design/concepts/Reflecting.md" with { type: "text" };
import {
  ReflectingConcept, JournalCreated, WriteNoJournal, WriteInvalidEntry,
  PageAlreadyExists, EditNoJournal, EditInvalidReference, EditNoPage,
  EditAmbiguousPage, EditInvalidEntry, ReadNoJournal, ReadInvalidReference,
  ReadNoStory, ReadNoPage, ReadAmbiguousPage, GetJournalNotFound,
  SaveInvalidReference, SaveTextTooLong, SaveTooManyImages, SaveImageTooLarge,
  SaveInvalidImage, SaveNoEntry, GetInvalidReference, ReflectionUnavailable,
} from "./Reflecting.ts";

export const reflecting = registerConcept({
  class: ReflectingConcept,
  spec,
  refusals: {
    JOURNAL_CREATED: JournalCreated,
    WRITE_NO_JOURNAL: WriteNoJournal,
    WRITE_INVALID_ENTRY: WriteInvalidEntry,
    WRITE_PAGE_EXISTS: PageAlreadyExists,
    EDIT_NO_JOURNAL: EditNoJournal,
    EDIT_INVALID_REFERENCE: EditInvalidReference,
    EDIT_NO_PAGE: EditNoPage,
    EDIT_AMBIGUOUS_PAGE: EditAmbiguousPage,
    EDIT_INVALID_ENTRY: EditInvalidEntry,
    READ_NO_JOURNAL: ReadNoJournal,
    READ_INVALID_REFERENCE: ReadInvalidReference,
    READ_NO_STORY: ReadNoStory,
    READ_NO_PAGE: ReadNoPage,
    READ_AMBIGUOUS_PAGE: ReadAmbiguousPage,
    GET_JOURNAL_NOT_FOUND: GetJournalNotFound,
    SAVE_INVALID_REFERENCE: SaveInvalidReference,
    SAVE_TEXT_TOO_LONG: SaveTextTooLong,
    SAVE_TOO_MANY_IMAGES: SaveTooManyImages,
    SAVE_IMAGE_TOO_LARGE: SaveImageTooLarge,
    SAVE_INVALID_IMAGE: SaveInvalidImage,
    SAVE_NO_ENTRY: SaveNoEntry,
    GET_INVALID_REFERENCE: GetInvalidReference,
    REFLECTION_UNAVAILABLE: ReflectionUnavailable,
  },
});

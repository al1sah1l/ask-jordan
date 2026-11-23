# Reflecting

## Purpose

Retain private editable chapter-linked text and photos, so work can be reopened without publishing it or completing another workflow.

## Principle

George saves a photo of his songwriting activity, reopens the page, adds a reflection, and removes the photo. The page keeps its identity. Repeating the same replacement creates no duplicate. Another user's journal cannot return George's page.

## Types

```types
external User
  An opaque owner.
external Story
  An opaque subject.
external Chapter
  An opaque chapter reference, including legacy numeric references.
opaque ImageList
  An ordered array of uploaded-image JSON data URL strings, never remote URLs.
opaque PageList
  An array of records containing page, story, chapter, text, and images.
opaque PageResult
  Null or one record containing page, story, chapter, text, and images.
```

## State

```state
a set of Journals with
  a unique user User

a set of Pages with
  a journal Journal
  a story Story
  a chapter Chapter
  a text String
  an images ImageList
  unique journal and story and chapter

Rule: Only the Journal's user may address its Pages. Story and Chapter remain opaque; this concept does not determine story ownership or progress.
Rule: Text is trimmed and at most 5,000 characters. Content requires nonempty text, at least one image, or both.
Rule: Images contains at most three complete decodable JPEG, PNG, or WebP images, each at most 1,048,576 decoded bytes, matching its declared MIME type. Corrupt images, forged MIME/data, SVG, other formats, and remote URLs are invalid.
Rule: References must be nonempty; legacy finite nonnegative numeric chapter references normalize to their string form.
Rule: Old pages without images mean an empty image list. Editing preserves page identity; no expiry or deletion is selected.
Rule: Input and content refusals leave all state unchanged. Page mutations enforce owner scope, page uniqueness, and complete replacement atomically; journal creation and page replacement are not one transaction. Successful mutations are durable before returning.
Rule: Storage failure refuses REFLECTION_UNAVAILABLE and never represents persisted work as absent. A failed page replacement preserves previous saved page content; an empty ensured Journal may remain if journal creation succeeded first. Preserved page content is readable when storage becomes available again.
Rule: Omitted images on write mean an empty list; omitted images on edit preserve existing images. Save always replaces the complete list.
Rule: Legacy chapter-only selection must match exactly one owned Page, never choose silently among different stories.
```

## Actions

```actions
createJournal (user: User) : returns (journal: Journal)
  where a Journal already belongs to user
  then
    refuses JOURNAL_CREATED "This user already has a journal."
  where no Journal belongs to user
  then
    create journal with user
    returns journal

write (user: User, story: Story, chapter: Chapter, text: String, images?: ImageList) : returns (page: Page)
  where user has no Journal
  then
    refuses WRITE_NO_JOURNAL "This user does not have a journal yet."
  where user has a Journal and references or resulting content are invalid
  then
    refuses WRITE_INVALID_ENTRY "Supply valid chapter work with text or up to three supported photos."
  where user has a Journal, input is valid, and its story/chapter Page already exists
  then
    refuses WRITE_PAGE_EXISTS "This journal already has a page for this story and chapter."
  where user has a Journal, input is valid, and its story/chapter Page is absent
  then
    create page in that Journal with story, normalized chapter, trimmed text, and supplied images or an empty list
    returns page

edit (user: User, chapter: Chapter, text: String, story?: Story, images?: ImageList) : returns (page: Page)
  where user has no Journal
  then
    refuses EDIT_NO_JOURNAL "This user does not have a journal yet."
  where user has a Journal and supplied references are invalid
  then
    refuses EDIT_INVALID_REFERENCE "This story or chapter reference is invalid."
  where user has a Journal, references are valid, and no Page matches chapter and any supplied story
  then
    refuses EDIT_NO_PAGE "The page you want to edit could not be found."
  where user has a Journal, references are valid, and multiple Pages match without a story
  then
    refuses EDIT_AMBIGUOUS_PAGE "Specify the story for this chapter."
  where references are valid, exactly one owned Page matches, and resulting content is invalid
  then
    refuses EDIT_INVALID_ENTRY "Supply text or up to three supported photos within the limits."
  where references are valid, exactly one owned Page matches, and resulting content is valid
  then
    bind the matching Page as page
    replace its text with trimmed text and replace images only when supplied, preserving its identity and associations
    returns page

read (user: User, story?: Story, chapter?: Chapter) : returns (page: Page)
  where user has no Journal
  then
    refuses READ_NO_JOURNAL "This user does not have a journal yet."
  where user has a Journal and supplied references are invalid
  then
    refuses READ_INVALID_REFERENCE "This story or chapter reference is invalid."
  where user has a Journal, references are valid, story is supplied, and no Page matches all supplied filters
  then
    refuses READ_NO_STORY "This user does not have an entry for this story."
  where user has a Journal, references are valid, story is omitted, and either chapter is omitted or no Page matches chapter
  then
    refuses READ_NO_PAGE "The page you want to read could not be found."
  where references are valid, at least one filter is supplied, and multiple owned Pages match
  then
    refuses READ_AMBIGUOUS_PAGE "Specify both story and chapter."
  where references are valid and exactly one owned Page matches at least one supplied filter
  then
    bind that Page as page without changing state
    returns page

getJournal (user: User) : returns (pages: PageList)
  where user has no Journal
  then
    refuses GET_JOURNAL_NOT_FOUND "This user does not have a journal yet."
  where user has a Journal
  then
    collect its complete Page records as pages ordered by chapter, then story, then page identity, comparing numeric chapter references numerically and other references lexically
    returns pages

save (user: User, story: Story, chapter: Chapter, text: String, images: ImageList) : returns (page: Page)
  where supplied references are invalid
  then
    refuses SAVE_INVALID_REFERENCE "This story or chapter reference is invalid."
  where references are valid and text exceeds 5,000 trimmed characters
  then
    refuses SAVE_TEXT_TOO_LONG "Keep your reflection within 5,000 characters."
  where references and text length are valid and images contains more than three entries
  then
    refuses SAVE_TOO_MANY_IMAGES "Choose up to three photos."
  where references, text length, and count are valid and an image exceeds the decoded byte limit
  then
    refuses SAVE_IMAGE_TOO_LARGE "Choose photos of at most 1 MB each."
  where references, lengths, and count are valid and an image is invalid or unsupported
  then
    refuses SAVE_INVALID_IMAGE "Choose valid JPEG, PNG, or WebP photos."
  where references and limits are valid and trimmed text and images are empty
  then
    refuses SAVE_NO_ENTRY "Add a reflection or photo before saving."
  where references and content are valid and required durable storage is unavailable or page replacement fails
  then
    preserve any previously saved Page content; an already ensured empty Journal may remain
    refuses REFLECTION_UNAVAILABLE "Your saved work is temporarily unavailable. Please retry."
  where references and content are valid and durable operations succeed
  then
    ensure user has one Journal without duplicating an existing Journal
    create its story/chapter Page if absent or bind the matching Page as page
    replace its complete content with trimmed text and images, retaining page identity
    make the replacement durable before returning
    returns page

get (user: User, story: Story, chapter: Chapter) : returns (entry: PageResult)
  where supplied references are invalid
  then
    refuses GET_INVALID_REFERENCE "This story or chapter reference is invalid."
  where supplied references are valid and durable page access is unavailable
  then
    leave all saved content unchanged and do not return an absent entry
    refuses REFLECTION_UNAVAILABLE "Your saved work is temporarily unavailable. Please retry."
  where supplied references are valid and durable page access succeeds
  then
    bind the complete matching owned Page record as entry, or null when no Journal or Page exists
    leave state unchanged
    returns entry
```

## Queries

```queries
_journal (user: User) : many (journal: Journal, user: User)
  answers the Journal belonging to user
  answers no rows when user has no Journal and otherwise exactly one row
  orders rows by Journal identity

_page (user: User, story?: Story, chapter?: Chapter) : many (page: Page, story: Story, chapter: Chapter, text: String, images: ImageList)
  answers complete owned Pages matching every supplied filter
  answers no rows when no Journal or matching Page exists
  orders rows by Page identity

_pages (user: User) : many (page: Page, story: Story, chapter: Chapter, text: String, images: ImageList)
  answers complete Pages in the user's Journal
  answers no rows when no Journal or Pages exist
  orders rows by Page identity
```

# Reflecting

## Purpose

Provide users with a space to reflect on their thoughts and opinions after each chapter of a story. Keep those reflections available so users can revisit how their thoughts developed throughout an exploration.

## Principle

After reading a chapter, a user can record their thoughts about the experience. Each reflection belongs to a story and chapter. Users can retrieve and edit their reflections later.

## Types

```types
external User
  The account Authenticating returned.

external Story
  A story created by StoryGeneration.

external Chapter
  A chapter belonging to a StoryGeneration story.
```

## State

```state
a set of Journals with
  a unique owner User

a set of Pages with
  an owner Journal
  a Story
  a Chapter
  a text String
  unique owner and story and chapter
```

## Actions

```actions
createJournal (user: User) : returns (journal: Journal)
  where user already has a journal
  then
    refuses JOURNAL_CREATED "This user already has a journal."
  where user has no journal
  then
    create an empty Journal for user
    returns journal

write (user: User, story: Story, chapter: Chapter, text: String) : returns (page: Page)
  where user has no journal
  then
    refuses NO_JOURNAL_FOUND "This user does not have a journal yet."
  where story or chapter is invalid
  then
    refuses INVALID_STORY_OR_CHAPTER "This story or chapter is invalid."
  where a Page already exists for user, story, and chapter
  then
    refuses NOT_ABLE_TO_WRITE "This story already contains this chapter."
  where text is blank
  then
    refuses NO_ENTRY "You must write some reflection on your experience."
  where user has a journal, story and chapter are valid, no Page exists for story and chapter, and text is not blank
  then
    add a Page to the user's Journal with story, chapter, and text
    returns page

edit (user: User, story: Story, chapter: Chapter, text: String) : returns (page: Page)
  where user has no journal
  then
    refuses NO_JOURNAL_FOUND "This user does not have a journal yet."
  where story or chapter is invalid
  then
    refuses INVALID_STORY_OR_CHAPTER "This story or chapter is invalid."
  where text is blank
  then
    refuses NO_ENTRY "You must write some reflection on your experience."
  where no Page exists for user, story, and chapter
  then
    refuses NO_PAGE_FOUND "The page you want to edit could not be found."
  where a Page exists for user, story, and chapter and text is not blank
  then
    update the Page text
    returns page

read (user: User, story: Story) : returns (page: Page)
  where user has no journal
  then
    refuses NO_JOURNAL_FOUND "This user does not have a journal yet."
  where no Page exists for user and story
  then
    refuses NO_STORY_FOUND "This user does not have an entry for this story."
  where a Page exists for user and story
  then
    returns page

getJournal (user: User) : returns (pages: Page)
  where user has no journal
  then
    refuses NO_JOURNAL_FOUND "This user does not have a journal yet."
  where user has a journal
  then
    returns pages
```

## Queries

```queries
_journal (user: User) : optional (journal: Journal, user: User)
  Returns the user's journal, if one exists.

_page (user: User, story: Story, chapter: Chapter) : optional (page: Page, story: Story, chapter: Chapter, text: String)
  Returns the reflection for the given story and chapter, if one exists.

_pages (user: User) : many (page: Page, story: Story, chapter: Chapter, text: String)
  Returns all reflections in the user's journal.
```

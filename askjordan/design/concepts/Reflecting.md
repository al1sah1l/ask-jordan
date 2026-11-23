# Reflecting


## Purpose

provide users with a space to reflect on their thoughts and opinions after each chapter of a story; prevents users from losing their reflections and allows them to revisit how their thoughts developed throughout an exploration.


## Principle
after reading a chapter, a user can record their thoughts about the experience. Each reflection is associated with a specific chapter, allowing users to reflect multiple times while exploring the same interest. Reflections can later be retrieved or edited.


## Types
```
external User
    the person who is reflecting on their experience

external Story
    the story detailing the Interest and experience that the user explored

external Chapter
    the numeric representation of the chapter of the story that the user is reflecting on
```

## State
```state
a set of Journals with
    an owner User
    a set of Pages

a Page containing
    a Story
    a Chapter
    a text String
```

## Actions

```actions

createJournal(user: User): returns (journal: Journal)

where user does already have a journal

then
    refuses JOURNAL_CREATED "This user already has a journal."

where user does not have a journal

then
    create a new Journal with user User and an empty set of Pages.
    returns journal

write (user: User, story: Story, chapter: Chapter, text: String): returns (page: Page)

where user does not have a journal

then
    refuses NO_JOURNAL_FOUND "This user does not have a journal yet."

where story is invalid or chapter is invalid

then
    refuses INVALID_STORY_OR_CHAPTER "This story or chapter is invalid."

where story already contains chapter

then
    refuses NOT_ABLE_TO_WRITE "This story already contains this chapter."

where text is empty

then
    refuses NO_ENTRY "You must write some reflection on your experience."

where user does have a journal, story is valid, chapter is valid, and text is nonempty

then
    create a new Page with story, chapter, and text
    add page to journal
    return page

edit (user: User, story: Story, chapter: Chapter, text: String): (page: Page)

where user does not have a journal

then
    refuses NO_JOURNAL_FOUND "This user does not have a journal yet."

where story is invalid or chapter is invalid

then
    refuses INVALID_STORY_OR_CHAPTER "This story or chapter is invalid."

where text is empty

then
    refuses NO_ENTRY "You must write some reflection on your experience."

where user does have a journal, story is valid, chapter is valid, and no page is found

then
    refuses NO_PAGE_FOUND "The page you want to edit could not be found"

where user does have a journal, story is valid, chapter is valid, and text is nonempty

then
    edit page to have text
    return page


read(user: User, story: Story): (page: Page)

where user does not have a journal

then
    refuses NO_JOURNAL_FOUND "This user does not have a journal yet."

where there is no page with story

then
    refuses NO_STORY_FOUND "This user does not have an entry for this story."

where user has a journal that contains a page with story

then
    return page associated with story.

getJournal(user: User): (pages: set Page)

where user does not have a journal

then
    refuses NO_JOURNAL_FOUND "This user does not have a journal yet."

where user does have a journal

then
    return the pages of the journal
```

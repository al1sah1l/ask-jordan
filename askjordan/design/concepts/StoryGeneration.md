
# StoryGeneration

## Purpose

Help users explore an activity through a short personalized story with interactive questions and a small practical activity to try.

This contract describes the original three-chapter format. The default Story
Experience also supports progressive learning chapters through ProgressiveStoryEngine;
both formats follow the profile, recovery, and prepared-content behavior described
in the Interest API composition.

## Principle

George chooses Songwriting and receives the first chapter of a story. His answer influences the next chapter, which asks another question. After he answers, the third and final chapter concludes the story and suggests a practical activity. George cannot generate another story for the same activity or continue a story beyond its third chapter. Other users cannot access or change his story.

## Types

```types
external User
  The user exploring an activity.

external Activity
  The activity selected for exploration.

opaque ChoiceList
  An ordered array of two to four distinct nonblank answer strings, each at most 200 characters.

opaque ChapterList
  An ordered array of records with chapter, story, position, text, optional question, optional choices, optional answer, and optional suggestedActivity fields.

opaque StoryList
  A collection of story summaries.
```

## State

```state
a set of Stories with
  a user User
  an activity Activity
  a context String
  a chapters seq of Chapter
  unique user and activity

a seq of Chapters with
  a story Story
  a position Number
  a text String
  an optional question String
  an optional choices ChoiceList
  an optional answer String
  an optional suggestedActivity String

Rule: A Story contains between one and three Chapters.
Rule: Chapters have consecutive positions beginning with 1.
Rule: Chapters 1 and 2 contain questions.
Rule: Chapter 3 has no question and suggests a real-world activity.
Rule: Each user has at most one Story for a given Activity.
Rule: A Story captures the supplied context at creation. The application supplies the authenticated user's latest saved profile description, including an empty description; later profile edits do not rewrite existing Stories or their context.
Rule: Generation uses prepared content when configured to do so or when a model request fails, times out, or produces unusable content. This applies independently to the opening, continuation, and ending; fallback uses the same Activity, context, and accepted answers.
Rule: Saved chapter identities, text, questions, accepted answers, ending, and suggested activity remain readable in order after refresh and restoration, without model calls or replaying accepted answers.
Rule: Prepared prompts default to short open-ended why questions with text answers and no choices. Choices are optional only for genuinely applicable future or live closed decisions and contain two to four meaningful answers. Chapter 3 has neither question nor choices.
Rule: Choices belong to their question. Malformed supplied choices cause a coherent prepared open-ended why question without choices; never attach unrelated choices to a live question.
Rule: On restore, recognized unanswered legacy prepared questions become their corresponding short open-ended why questions and lose choices. Answered historical chapters retain their original questions and accepted answers. This upgrade preserves chapter identities, story text, chapter order, and narrative state. Unrecognized questions retain their existing valid optional choice metadata.
Rule: New answers are trimmed and must equal an offered choice when choices are present; prepared open-ended questions accept nonblank text. Previously accepted answers are never replayed or revalidated by restoration.
Rule: Every refusal leaves state unchanged. Continuation atomically verifies the current answering chapter and commits its answer with one successor; races cannot answer or advance a chapter twice.
Rule: Repeated generation for the same user/activity refuses. A stale supplied expectedChapter refuses, including a repeated accepted continuation; callers recover by reading the story. Omission retains legacy latest-chapter behavior.
```

## Actions

```actions
generateStory (user: User, activity: Activity, context: String) : returns (story: Story, chapter: Chapter)
  where a Story already exists for user and activity
  then
    refuses STORY_ALREADY_EXISTS "This user already has a story for this activity."
  where no Story exists for user and activity
  then
    create a Story for user and activity with the supplied context
    create its first Chapter with position 1 and text, using a short open-ended why question without choices for prepared content and valid optional choices only for an applicable live closed decision
    associate the new Chapter with the Story
    returns story, chapter

continueStory (user: User, story: Story, answer: String, expectedChapter?: Chapter) : returns (chapter: Chapter)
  where the Story does not exist or belongs to another user
  then
    refuses STORY_NOT_FOUND "This story does not belong to the user."
  where the Story belongs to user and supplied expectedChapter is not its latest unanswered Chapter
  then
    refuses STALE_STORY_CHAPTER "This chapter has already changed; reopen the story."
  where the Story belongs to user, expectedChapter is absent or current, and the answer is blank or does not match an offered choice
  then
    refuses INVALID_STORY_ANSWER "Choose an offered answer or enter a nonblank answer for an open question."
  where the Story belongs to user, expectedChapter is absent or current, the answer is valid, and the Story has three Chapters or its latest Chapter cannot be answered
  then
    refuses STORY_CANNOT_CONTINUE "The story cannot be continued."
  where the Story belongs to user, expectedChapter is absent or current, the answer is valid, its latest Chapter has an unanswered question, and it has fewer than three Chapters
  then
    save the trimmed answer on the latest Chapter
    create chapter as its successor using Activity, context, and earlier answers
    give Chapter 2 a short open-ended why question without choices for prepared content, or valid optional choices only for an applicable live closed decision
    give Chapter 3 a suggested real-world activity and neither question nor choices
    append chapter to the Story atomically with the accepted answer
    returns chapter

getStory (user: User, story: Story) : returns (chapters: ChapterList)
  where the Story does not exist or belongs to another user
  then
    refuses GET_STORY_NOT_FOUND "This story does not belong to the user."
  where the Story belongs to user
  then
    collect all Chapters in their original order as chapters
    returns chapters

getActivityChapter (user: User, story: Story) : returns (chapter: Chapter)
  where the Story does not exist or belongs to another user
  then
    refuses ACTIVITY_STORY_NOT_FOUND "This story does not belong to the user."
  where the Story belongs to user and has no third Chapter with a nonblank suggested activity
  then
    refuses ACTIVITY_NOT_REACHED "Reach the final activity before saving your work."
  where the Story belongs to user and has its third Chapter with a nonblank suggested activity
  then
    bind that third Chapter as chapter without changing state
    returns chapter

getStories (user: User) : returns (stories: StoryList)
  where true
  then
    collect all Stories belonging to user with their associated Activities as stories
    order Stories by activity
    returns stories
```

## Queries

```queries
```

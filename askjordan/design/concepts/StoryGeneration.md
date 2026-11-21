
# StoryGeneration

## Purpose

Help users explore an activity through a short personalized story with interactive questions and a small practical activity to try.

## Principle

George chooses Songwriting and receives the first chapter of a story. His answer influences the next chapter, which asks another question. After he answers, the third and final chapter concludes the story and suggests a practical activity. George cannot generate another story for the same activity or continue a story beyond its third chapter. Other users cannot access or change his story.

## Types

```types
external User
  The user exploring an activity.

external Activity
  The activity selected for exploration.

opaque ChapterList
  An ordered collection of chapter records.

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
  an optional answer String
  an optional suggestedActivity String

Rule: A Story contains between one and three Chapters.
Rule: Chapters have consecutive positions beginning with 1.
Rule: Chapters 1 and 2 contain questions.
Rule: Chapter 3 has no question and suggests a real-world activity.
Rule: Each user has at most one Story for a given Activity.
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
    create its first Chapter with position 1, text, and a question
    associate the new Chapter with the Story
    returns story, chapter

continueStory (user: User, story: Story, answer: String) : returns (chapter: Chapter)
  where the Story does not exist or belongs to another user
  then
    refuses STORY_NOT_FOUND "This story does not belong to the user."
  where the Story belongs to user and the answer is blank
  then
    refuses INVALID_STORY_ANSWER "An answer cannot be blank."
  where the Story belongs to user, the answer is not blank, and the Story already has three Chapters or its latest Chapter cannot be answered
  then
    refuses STORY_CANNOT_CONTINUE "The story cannot be continued."
  where the Story belongs to user, the answer is not blank, the latest Chapter has an unanswered question, and the Story has fewer than three Chapters
  then
    save the answer on the latest Chapter
    create the next Chapter using the Activity, context, and earlier answers
    give Chapter 2 a question
    give Chapter 3 a suggested real-world activity and no question
    append the Chapter to the Story
    returns chapter

getStory (user: User, story: Story) : returns (chapters: ChapterList)
  where the Story does not exist or belongs to another user
  then
    refuses STORY_NOT_FOUND "This story does not belong to the user."
  where the Story belongs to user
  then
    collect all Chapters in their original order
    returns chapters

getStories (user: User) : returns (stories: StoryList)
  where true
  then
    collect all Stories belonging to user with their associated Activities
    order Stories by activity
    returns stories
```

## Queries

```queries
```

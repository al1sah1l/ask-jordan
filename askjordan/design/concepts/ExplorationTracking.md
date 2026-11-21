
# ExplorationTracking

## Purpose

Keep track of stories users have started and completed so they can return to previous explorations and review their progress.

## Principle

George starts a story about Songwriting, creating an exploration with status started. When he reaches the final chapter and explicitly marks the story complete, its status changes to completed. Starting the same story twice or completing it twice is refused. Another user cannot complete George's exploration.

## Types

```types
external User
  The user exploring a story.

external Story
  A story created by StoryGeneration.

opaque Status
  Either "started" or "completed".
```

## State

```state
a set of Explorations with
  an owner User
  a story Story
  a status Status
  unique owner and story

Rule: Each Exploration has status started or completed.
Rule: A completed Exploration cannot return to started.
```

## Actions

```actions
startExploration (user: User, story: Story) : returns (exploration: Exploration)
  where an Exploration already exists for user and story
  then
    refuses EXPLORATION_ALREADY_STARTED "This story already has an exploration."
  where no Exploration exists for user and story
  then
    add a new Exploration with owner user, story, and status started
    returns exploration

completeExploration (user: User, story: Story) : returns (exploration: Exploration)
  where no started Exploration exists for user and story
  then
    refuses EXPLORATION_NOT_STARTED "This user has no started exploration for this story."
  where an Exploration exists for user and story with status started
  then
    change the Exploration's status to completed
    returns exploration
```

## Queries

```queries
_get (user: User, story: Story) : optional (exploration: Exploration, user: User, story: Story, status: Status)
  Answers the Exploration belonging to user for story.
  Returns no row if that user has no Exploration for the Story.

_history (user: User) : many (exploration: Exploration, user: User, story: Story, status: Status)
  Returns all Explorations belonging to user.
  Returns an empty set if the user has no Explorations.
  Orders results by exploration identifier.

_completed (user: User) : many (exploration: Exploration, user: User, story: Story, status: Status)
  Returns only completed Explorations belonging to user.
  Returns an empty set if none are completed.
  Orders results by exploration identifier.
```


# Ask Jordan — Story Exploration Composition

## Purpose

Connect StoryGeneration and ExplorationTracking so that
starting a new interactive story automatically creates
an exploration record for the same student and story.

## Story Exploration

When StoryGeneration successfully generates a new story,
the application
[starts an exploration for that story](reaction:AskJordan.StoryExploration.StoryCreatedStartsExploration).

The synchronization passes the same User and Story
identifiers to ExplorationTracking.startExploration.

The exploration starts with status "started".

If StoryGeneration refuses to generate a story,
no exploration is created by this reaction.

## Completion

Generating the third chapter does not automatically
mark an exploration as completed.

The student must explicitly choose to mark their
exploration complete.

ExplorationTracking.completeExploration remains a
separate action.

The application workflow checks that all three story
chapters exist before allowing the student to complete
the exploration.

## Design Rationale

StoryGeneration owns the story and its chapters.

ExplorationTracking owns exploration progress and status.

Neither concept imports the other.

The composition connects them without changing
their independently defined responsibilities.

## Current Limitations

- Concept state is currently stored in memory.
- The reaction is not a database transaction.
- If the follow-up exploration action fails, the generated story is not automatically rolled back.
- The user-facing completion workflow is not yet exposed as a frontend endpoint.

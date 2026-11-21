<!-- Generated from the Ask Jordan assembly. Do not edit. -->
<!-- Manifest producer: @mit-sdg/sync-engine@1.2.0; concept specification: sync-engine.concept-specification@1; renderer: @mit-sdg/sync-engine@1.2.0. -->

# Ask Jordan — assembled read-back

_Assembled by sync-engine from registered concepts and composition. Edit the concept_
_specifications and composition source, then regenerate this file._

## Concepts

### ExplorationTracking

Defined in [ExplorationTracking](../design/concepts/ExplorationTracking.md), line 2.

#### Actions

- `startExploration(user: User, story: Story) : returns (exploration: Exploration)`
  - Refuses `EXPLORATION_ALREADY_STARTED`: This story already has an exploration.
- `completeExploration(user: User, story: Story) : returns (exploration: Exploration)`
  - Refuses `EXPLORATION_NOT_STARTED`: This user has no started exploration for this story.

#### Queries

- `_get(user: User, story: Story) : optional (exploration: Exploration, user: User, story: Story, status: Status)`
- `_history(user: User) : many (exploration: Exploration, user: User, story: Story, status: Status)`
- `_completed(user: User) : many (exploration: Exploration, user: User, story: Story, status: Status)`

#### Instances

- `ExplorationTracking` — instance of `ExplorationTracking` — [Ask Jordan Application Types](../design/types.md), line 16.
  - `Story` is `StoryGeneration.Story` — [Ask Jordan Application Types](../design/types.md), line 18.
  - `User` is `User` — [Ask Jordan Application Types](../design/types.md), line 17.

### InterestCollection

Defined in [InterestCollection](../design/concepts/InterestCollection.md), line 2.

#### Actions

- `registerTopic(name: String, description: String) : returns (topic: Topic)`
  - Refuses `INVALID_CATALOG_ENTRY`: A topic name cannot be blank.
  - Refuses `CATALOG_ENTRY_EXISTS`: This topic already exists.
- `registerActivity(name: String, description: String, topics: Topics) : returns (activity: Activity)`
  - Refuses `INVALID_CATALOG_ENTRY`: An activity needs a name and at least one topic.
  - Refuses `CATALOG_ENTRY_EXISTS`: This activity already exists.
  - Refuses `CATALOG_ENTRY_NOT_FOUND`: One of the topics does not exist.
- `connectActivities(activity1: Activity, activity2: Activity) : returns (connection: Connection)`
  - Refuses `CATALOG_ENTRY_NOT_FOUND`: Both activities must exist.
  - Refuses `INVALID_CATALOG_ENTRY`: An activity cannot connect to itself.
  - Refuses `CONNECTION_EXISTS`: The connection already exists.
- `setPreference(user: User, subject: Subject, status: Status) : returns (preference: Preference)`
  - Refuses `CATALOG_ENTRY_NOT_FOUND`: The topic or activity does not exist.
  - Refuses `INVALID_PREFERENCE`: Invalid preference status.

#### Queries

- `_topics() : many (topic: Topic, name: String, description: String)`
- `_activities() : many (activity: Activity, name: String, description: String)`
- `_connections() : many (connection: Connection, first: Subject, second: Subject)`
- `_preferences(user: User) : many (preference: Preference, user: User, subject: Subject, status: Status)`
- `_related(subject: Subject) : many (subject: Subject)`

#### Instances

- `InterestCollection` — instance of `InterestCollection` — [Ask Jordan Application Types](../design/types.md), line 13.
  - `User` is `User` — [Ask Jordan Application Types](../design/types.md), line 14.

### InterestGeneration

Defined in [InterestGeneration](../design/concepts/InterestGeneration.md), line 2.

#### Actions

- `generateSuggestions(user: User, preferences: PreferenceCatalog, activities: ActivityCatalog, connections: ConnectionCatalog, startedActivities: ActivityIds) : returns (suggestions: SuggestionIds)`
  - Refuses `NO_ACTIVITIES_AVAILABLE`: No activities are available for suggestions.
- `dismissSuggestion(user: User, suggestion: Suggestion) : returns (suggestion: Suggestion)`
  - Refuses `SUGGESTION_NOT_FOUND`: No pending suggestion exists for this user.

#### Queries

- `_getSuggestions(user: User) : many (suggestion: Suggestion, user: User, activity: Activity, status: Status)`

#### Instances

- `InterestGeneration` — instance of `InterestGeneration` — [Ask Jordan Application Types](../design/types.md), line 20.
  - `Activity` is `InterestCollection.Activity` — [Ask Jordan Application Types](../design/types.md), line 22.
  - `User` is `User` — [Ask Jordan Application Types](../design/types.md), line 21.

### StoryGeneration

Defined in [StoryGeneration](../design/concepts/StoryGeneration.md), line 2.

#### Actions

- `generateStory(user: User, activity: Activity, context: String) : returns (story: Story, chapter: Chapter)`
  - Refuses `STORY_ALREADY_EXISTS`: This user already has a story for this activity.
- `continueStory(user: User, story: Story, answer: String) : returns (chapter: Chapter)`
  - Refuses `STORY_NOT_FOUND`: This story does not belong to the user.
  - Refuses `INVALID_STORY_ANSWER`: An answer cannot be blank.
  - Refuses `STORY_CANNOT_CONTINUE`: The story cannot be continued.
- `getStory(user: User, story: Story) : returns (chapters: ChapterList)`
  - Refuses `STORY_NOT_FOUND`: This story does not belong to the user.
- `getStories(user: User) : returns (stories: StoryList)`

#### Instances

- `StoryGeneration` — instance of `StoryGeneration` — [Ask Jordan Application Types](../design/types.md), line 24.
  - `Activity` is `InterestCollection.Activity` — [Ask Jordan Application Types](../design/types.md), line 26.
  - `User` is `User` — [Ask Jordan Application Types](../design/types.md), line 25.

## Application types

Concrete types:

- `User` — [Ask Jordan Application Types](../design/types.md), line 8.

## Reactions

### DeliverFaultToAsker

```reaction
when any action is faulted, not asked by DeliverFaultToAsker
where
  earlier, RequestBoundary.request (requestId)
then
  RequestBoundary.respondFramework (error: "INTERNAL_ERROR", requestId)
```

### DeliverRefusalToAsker

```reaction
when any action is refused (message), except RequestBoundary
where
  earlier, RequestBoundary.request (requestId)
then
  RequestBoundary.respond (error: message, requestId)
```


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

- `ExplorationTracking` — instance of `ExplorationTracking` — [Ask Jordan Application Types](../design/types.md), line 18.
  - `Story` is `Story` — [Ask Jordan Application Types](../design/types.md), line 20.
  - `User` is `User` — [Ask Jordan Application Types](../design/types.md), line 19.

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

- `InterestCollection` — instance of `InterestCollection` — [Ask Jordan Application Types](../design/types.md), line 15.
  - `User` is `User` — [Ask Jordan Application Types](../design/types.md), line 16.

## Application types

Concrete types:

- `Story` — [Ask Jordan Application Types](../design/types.md), line 10.
- `User` — [Ask Jordan Application Types](../design/types.md), line 7.

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


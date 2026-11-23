<!-- Generated from the Ask Jordan assembly. Do not edit. -->
<!-- Manifest producer: @mit-sdg/sync-engine@1.2.0; concept specification: sync-engine.concept-specification@1; renderer: @mit-sdg/sync-engine@1.2.0. -->

# Ask Jordan — assembled read-back

_Assembled by sync-engine from registered concepts and composition. Edit the concept_
_specifications and composition source, then regenerate this file._

## Concepts

### Account

Defined in [Account](../design/concepts/Account.md), line 1.

#### Actions

- `createAccount(user: User, name: String, about: String) : returns (profile: Profile)`
  - Refuses `BLANK_NAME`: A display name is required.
  - Refuses `PROFILE_EXISTS`: That user already has a profile.
- `updateProfile(user: User, name: String, about: String) : returns (profile: Profile)`
  - Refuses `NO_PROFILE`: That user has no profile.
  - Refuses `BLANK_NAME`: A display name is required.
- `getProfile(user: User) : returns (profile: Profile, name: String, about: String)`
  - Refuses `NO_PROFILE`: That user has no profile.

#### Instances

- `Account` — instance of `Account` — [Ask Jordan application types](../design/types.md), line 11.
  - `User` is `Authenticating.Account` — [Ask Jordan application types](../design/types.md), line 12.

### Authenticating

Defined in [Authenticating](../design/concepts/Authenticating.md), line 1.

#### Actions

- `register(username: String, password: String) : returns (account: Account)`
  - Refuses `INVALID_USERNAME`: A username must contain 3 to 32 letters, numbers, underscores, or hyphens.
  - Refuses `WEAK_PASSWORD`: A password must contain 8 to 128 characters.
  - Refuses `USERNAME_TAKEN`: That username is already registered.
- `authenticate(username: String, password: String) : returns (account: Account)`
  - Refuses `INVALID_CREDENTIALS`: The username or password is incorrect.

#### Instances

- `Authenticating` — instance of `Authenticating` — [Ask Jordan application types](../design/types.md), line 6.

### AvatarCustomizing

Defined in [AvatarCustomizing](../design/concepts/AvatarCustomizing.md), line 1.

#### Actions

- `grant(user: User, item: Item) : returns (user: User, item: Item)`
  - Refuses `ALREADY_HOLDS`: That item has already been granted.
- `equip(user: User, item: Item, slot: Slot) : returns (user: User, slot: Slot, item: Item)`
  - Refuses `INVALID_SLOT`: An item can be worn only on the head or the body.
  - Refuses `NOT_HOLDING`: That item has not been granted.
- `clear(user: User, slot: Slot) : returns (user: User, slot: Slot)`
  - Refuses `INVALID_SLOT`: An item can be worn only on the head or the body.
  - Refuses `NOT_WEARING`: Nothing is worn in that slot.
- `getEquipped(user: User) : returns (worn: WornSet)`
  - Refuses `NO_HOLDINGS`: Nothing has been granted, so there is nothing to wear.

#### Instances

- `AvatarCustomizing` — instance of `AvatarCustomizing` — [Ask Jordan application types](../design/types.md), line 14.
  - `User` is `Authenticating.Account` — [Ask Jordan application types](../design/types.md), line 15.

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

- `ExplorationTracking` — instance of `ExplorationTracking` — [Ask Jordan application types](../design/types.md), line 20.
  - `Story` is `StoryGeneration.Story` — [Ask Jordan application types](../design/types.md), line 22.
  - `User` is `Authenticating.Account` — [Ask Jordan application types](../design/types.md), line 21.

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

- `InterestCollection` — instance of `InterestCollection` — [Ask Jordan application types](../design/types.md), line 17.
  - `User` is `Authenticating.Account` — [Ask Jordan application types](../design/types.md), line 18.

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

- `InterestGeneration` — instance of `InterestGeneration` — [Ask Jordan application types](../design/types.md), line 24.
  - `Activity` is `InterestCollection.Activity` — [Ask Jordan application types](../design/types.md), line 26.
  - `User` is `Authenticating.Account` — [Ask Jordan application types](../design/types.md), line 25.

### Reflecting

Defined in [Reflecting](../design/concepts/Reflecting.md), line 1.

#### Actions

- `createJournal(user: User) : returns (journal: Journal)`
  - Refuses `JOURNAL_CREATED`: This user already has a journal.
- `write(user: User, story: Story, chapter: Chapter, text: String) : returns (page: Page)`
  - Refuses `NO_JOURNAL_FOUND`: This user does not have a journal yet.
  - Refuses `INVALID_STORY_OR_CHAPTER`: This story or chapter is invalid.
  - Refuses `NOT_ABLE_TO_WRITE`: This story already contains this chapter.
  - Refuses `NO_ENTRY`: You must write some reflection on your experience.
- `edit(user: User, story: Story, chapter: Chapter, text: String) : returns (page: Page)`
  - Refuses `NO_JOURNAL_FOUND`: This user does not have a journal yet.
  - Refuses `INVALID_STORY_OR_CHAPTER`: This story or chapter is invalid.
  - Refuses `NO_ENTRY`: You must write some reflection on your experience.
  - Refuses `NO_PAGE_FOUND`: The page you want to edit could not be found.
- `read(user: User, story: Story) : returns (page: Page)`
  - Refuses `NO_JOURNAL_FOUND`: This user does not have a journal yet.
  - Refuses `NO_STORY_FOUND`: This user does not have an entry for this story.
- `getJournal(user: User) : returns (pages: Page)`
  - Refuses `NO_JOURNAL_FOUND`: This user does not have a journal yet.

#### Queries

- `_journal(user: User) : optional (journal: Journal, user: User)`
- `_page(user: User, story: Story, chapter: Chapter) : optional (page: Page, story: Story, chapter: Chapter, text: String)`
- `_pages(user: User) : many (page: Page, story: Story, chapter: Chapter, text: String)`

#### Instances

- `Reflecting` — instance of `Reflecting` — [Ask Jordan application types](../design/types.md), line 32.
  - `Chapter` is `StoryGeneration.Chapter` — [Ask Jordan application types](../design/types.md), line 35.
  - `Story` is `StoryGeneration.Story` — [Ask Jordan application types](../design/types.md), line 34.
  - `User` is `Authenticating.Account` — [Ask Jordan application types](../design/types.md), line 33.

### Sessioning

Defined in [Sessioning](../design/concepts/Sessioning.md), line 1.

#### Actions

- `start(user: User) : returns (session: Session, expiresAt: DateTime)`
- `current(session: Session) : returns (user: User)`
  - Refuses `UNKNOWN_SESSION`: You are not signed in, or your session has ended.
- `end(session: Session) : returns (ended: Flag)`
  - Refuses `UNKNOWN_SESSION`: You are not signed in, or your session has ended.

#### Instances

- `Sessioning` — instance of `Sessioning` — [Ask Jordan application types](../design/types.md), line 8.
  - `User` is `Authenticating.Account` — [Ask Jordan application types](../design/types.md), line 9.

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

- `StoryGeneration` — instance of `StoryGeneration` — [Ask Jordan application types](../design/types.md), line 28.
  - `Activity` is `InterestCollection.Activity` — [Ask Jordan application types](../design/types.md), line 30.
  - `User` is `Authenticating.Account` — [Ask Jordan application types](../design/types.md), line 29.

## Formers

_Formers name result shapes evaluated when asked. The source former owns_
_the authored explanation; this section records the generated shape._

### catalog activities

Authored path: `InterestApi.InterestBrowsing.ActivitiesList`.
- Covered by [Interest API](../design/compositions/InterestApi.md), line 21.

```former
Former "catalog activities" — inputs (); bindings (activity, name, description); promises exactly one record — forms:
  each InterestCollection._activities () has (activity, description, name)
    form a record of
      activity
      description
      name
```

### catalog topics

Authored path: `InterestApi.InterestBrowsing.TopicsList`.
- Covered by [Interest API](../design/compositions/InterestApi.md), line 17.

```former
Former "catalog topics" — inputs (); bindings (topic, name, description); promises exactly one record — forms:
  each InterestCollection._topics () has (description, name, topic)
    form a record of
      description
      name
      topic
```

### explorations for a user

Authored path: `InterestApi.StoryExploring.ExplorationHistory`.
- Covered by [Interest API](../design/compositions/InterestApi.md), line 63.

```former
Former "explorations for a user" — inputs (user); bindings (exploration, story, status); promises exactly one record — forms:
  each ExplorationTracking._history (user) has (exploration, status, story)
    form a record of
      exploration
      status
      story
```

### preferences for a user

Authored path: `InterestApi.InterestBrowsing.PreferencesList`.
- Covered by [Interest API](../design/compositions/InterestApi.md), line 29.

```former
Former "preferences for a user" — inputs (user); bindings (preference, subject, status); promises exactly one record — forms:
  each InterestCollection._preferences (user) has (preference, status, subject)
    form a record of
      preference
      status
      subject
```

## Reactions

### Accounts.Profile.Create

Authored path: `Accounts.Profile.Create`.
- Covered by [Accounts](../design/compositions/Accounts.md), line 7.
- Covered by [Accounts](../design/compositions/Accounts.md), line 11.

```reaction
when RequestBoundary.request (about, name, path: "/account/create", requestId, session)
then
  Sessioning.current (session)
```

### Accounts.Profile.Create#2

Authored path: `Accounts.Profile.Create`.
- Covered by [Accounts](../design/compositions/Accounts.md), line 7.
- Covered by [Accounts](../design/compositions/Accounts.md), line 11.

```reaction
when Sessioning.current (session, user), asked by Accounts.Profile.Create
where
  earlier, RequestBoundary.request (about, name, path: "/account/create", requestId, session)
then
  Account.createAccount (about, name, user)
```

### Accounts.Profile.Create#3

Authored path: `Accounts.Profile.Create`.
- Covered by [Accounts](../design/compositions/Accounts.md), line 7.
- Covered by [Accounts](../design/compositions/Accounts.md), line 11.

```reaction
when Account.createAccount (about, name, user, profile), asked by Accounts.Profile.Create#2
where
  earlier, RequestBoundary.request (about, name, path: "/account/create", requestId, session)
then
  RequestBoundary.respond (profile, requestId)
```

### Accounts.Profile.Get

Authored path: `Accounts.Profile.Get`.
- Covered by [Accounts](../design/compositions/Accounts.md), line 21.
- Covered by [Accounts](../design/compositions/Accounts.md), line 25.

```reaction
when RequestBoundary.request (path: "/account/profile", requestId, session)
then
  Sessioning.current (session)
```

### Accounts.Profile.Get#2

Authored path: `Accounts.Profile.Get`.
- Covered by [Accounts](../design/compositions/Accounts.md), line 21.
- Covered by [Accounts](../design/compositions/Accounts.md), line 25.

```reaction
when Sessioning.current (session, user), asked by Accounts.Profile.Get
then
  Account.getProfile (user)
```

### Accounts.Profile.Get#3

Authored path: `Accounts.Profile.Get`.
- Covered by [Accounts](../design/compositions/Accounts.md), line 21.
- Covered by [Accounts](../design/compositions/Accounts.md), line 25.

```reaction
when Account.getProfile (user, about, name, profile), asked by Accounts.Profile.Get#2
where
  earlier, RequestBoundary.request (path: "/account/profile", requestId, session)
then
  RequestBoundary.respond (about, name, profile, requestId)
```

### Accounts.Profile.Update

Authored path: `Accounts.Profile.Update`.
- Covered by [Accounts](../design/compositions/Accounts.md), line 14.
- Covered by [Accounts](../design/compositions/Accounts.md), line 18.

```reaction
when RequestBoundary.request (about, name, path: "/account/update", requestId, session)
then
  Sessioning.current (session)
```

### Accounts.Profile.Update#2

Authored path: `Accounts.Profile.Update`.
- Covered by [Accounts](../design/compositions/Accounts.md), line 14.
- Covered by [Accounts](../design/compositions/Accounts.md), line 18.

```reaction
when Sessioning.current (session, user), asked by Accounts.Profile.Update
where
  earlier, RequestBoundary.request (about, name, path: "/account/update", requestId, session)
then
  Account.updateProfile (about, name, user)
```

### Accounts.Profile.Update#3

Authored path: `Accounts.Profile.Update`.
- Covered by [Accounts](../design/compositions/Accounts.md), line 14.
- Covered by [Accounts](../design/compositions/Accounts.md), line 18.

```reaction
when Account.updateProfile (about, name, user, profile), asked by Accounts.Profile.Update#2
where
  earlier, RequestBoundary.request (about, name, path: "/account/update", requestId, session)
then
  RequestBoundary.respond (profile, requestId)
```

### AskJordan.StoryExploration.StoryCreatedStartsExploration

Authored path: `AskJordan.StoryExploration.StoryCreatedStartsExploration`.
- Covered by [Ask Jordan — Story Exploration Composition](../design/compositions/ExplorationFlow.md), line 14.

```reaction
when StoryGeneration.generateStory (user, story)
then
  ExplorationTracking.startExploration (story, user)
```

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

### InterestApi.InterestBrowsing.GetActivities

Authored path: `InterestApi.InterestBrowsing.GetActivities`.
- Covered by [Interest API](../design/compositions/InterestApi.md), line 20.
- Covered by [Interest API](../design/compositions/InterestApi.md), line 33.

```reaction
when RequestBoundary.request (path: "/interests/activities", requestId, session)
then
  Sessioning.current (session)
```

### InterestApi.InterestBrowsing.GetActivities#2

Authored path: `InterestApi.InterestBrowsing.GetActivities`.
- Covered by [Interest API](../design/compositions/InterestApi.md), line 20.
- Covered by [Interest API](../design/compositions/InterestApi.md), line 33.

```reaction
when Sessioning.current (session, user), asked by InterestApi.InterestBrowsing.GetActivities
where
  earlier, RequestBoundary.request (path: "/interests/activities", requestId, session)
then
  RequestBoundary.respond (activities: former "catalog activities", requestId)
```

### InterestApi.InterestBrowsing.GetPreferences

Authored path: `InterestApi.InterestBrowsing.GetPreferences`.
- Covered by [Interest API](../design/compositions/InterestApi.md), line 28.
- Covered by [Interest API](../design/compositions/InterestApi.md), line 35.

```reaction
when RequestBoundary.request (path: "/interests/preferences", requestId, session)
then
  Sessioning.current (session)
```

### InterestApi.InterestBrowsing.GetPreferences#2

Authored path: `InterestApi.InterestBrowsing.GetPreferences`.
- Covered by [Interest API](../design/compositions/InterestApi.md), line 28.
- Covered by [Interest API](../design/compositions/InterestApi.md), line 35.

```reaction
when Sessioning.current (session, user), asked by InterestApi.InterestBrowsing.GetPreferences
where
  earlier, RequestBoundary.request (path: "/interests/preferences", requestId, session)
then
  RequestBoundary.respond (preferences: former "preferences for a user" with (user), requestId)
```

### InterestApi.InterestBrowsing.GetTopics

Authored path: `InterestApi.InterestBrowsing.GetTopics`.
- Covered by [Interest API](../design/compositions/InterestApi.md), line 16.
- Covered by [Interest API](../design/compositions/InterestApi.md), line 32.

```reaction
when RequestBoundary.request (path: "/interests/topics", requestId, session)
then
  Sessioning.current (session)
```

### InterestApi.InterestBrowsing.GetTopics#2

Authored path: `InterestApi.InterestBrowsing.GetTopics`.
- Covered by [Interest API](../design/compositions/InterestApi.md), line 16.
- Covered by [Interest API](../design/compositions/InterestApi.md), line 32.

```reaction
when Sessioning.current (session, user), asked by InterestApi.InterestBrowsing.GetTopics
where
  earlier, RequestBoundary.request (path: "/interests/topics", requestId, session)
then
  RequestBoundary.respond (requestId, topics: former "catalog topics")
```

### InterestApi.InterestBrowsing.SetPreference

Authored path: `InterestApi.InterestBrowsing.SetPreference`.
- Covered by [Interest API](../design/compositions/InterestApi.md), line 24.
- Covered by [Interest API](../design/compositions/InterestApi.md), line 34.

```reaction
when RequestBoundary.request (path: "/interests/preference", requestId, session, status, subject)
then
  Sessioning.current (session)
```

### InterestApi.InterestBrowsing.SetPreference#2

Authored path: `InterestApi.InterestBrowsing.SetPreference`.
- Covered by [Interest API](../design/compositions/InterestApi.md), line 24.
- Covered by [Interest API](../design/compositions/InterestApi.md), line 34.

```reaction
when Sessioning.current (session, user), asked by InterestApi.InterestBrowsing.SetPreference
where
  earlier, RequestBoundary.request (path: "/interests/preference", requestId, session, status, subject)
then
  InterestCollection.setPreference (status, subject, user)
```

### InterestApi.InterestBrowsing.SetPreference#3

Authored path: `InterestApi.InterestBrowsing.SetPreference`.
- Covered by [Interest API](../design/compositions/InterestApi.md), line 24.
- Covered by [Interest API](../design/compositions/InterestApi.md), line 34.

```reaction
when InterestCollection.setPreference (status, subject, user, preference), asked by InterestApi.InterestBrowsing.SetPreference#2
where
  earlier, RequestBoundary.request (path: "/interests/preference", requestId, session, status, subject)
then
  RequestBoundary.respond (preference, requestId)
```

### InterestApi.StoryExploring.ContinueStory

Authored path: `InterestApi.StoryExploring.ContinueStory`.
- Covered by [Interest API](../design/compositions/InterestApi.md), line 58.
- Covered by [Interest API](../design/compositions/InterestApi.md), line 71.

```reaction
when RequestBoundary.request (answer, path: "/stories/continue", requestId, session, story)
then
  Sessioning.current (session)
```

### InterestApi.StoryExploring.ContinueStory#2

Authored path: `InterestApi.StoryExploring.ContinueStory`.
- Covered by [Interest API](../design/compositions/InterestApi.md), line 58.
- Covered by [Interest API](../design/compositions/InterestApi.md), line 71.

```reaction
when Sessioning.current (session, user), asked by InterestApi.StoryExploring.ContinueStory
where
  earlier, RequestBoundary.request (answer, path: "/stories/continue", requestId, session, story)
then
  StoryGeneration.continueStory (answer, story, user)
```

### InterestApi.StoryExploring.ContinueStory#3

Authored path: `InterestApi.StoryExploring.ContinueStory`.
- Covered by [Interest API](../design/compositions/InterestApi.md), line 58.
- Covered by [Interest API](../design/compositions/InterestApi.md), line 71.

```reaction
when StoryGeneration.continueStory (answer, story, user, chapter), asked by InterestApi.StoryExploring.ContinueStory#2
where
  earlier, RequestBoundary.request (answer, path: "/stories/continue", requestId, session, story)
then
  RequestBoundary.respond (chapter, requestId)
```

### InterestApi.StoryExploring.GetExplorationHistory

Authored path: `InterestApi.StoryExploring.GetExplorationHistory`.
- Covered by [Interest API](../design/compositions/InterestApi.md), line 62.
- Covered by [Interest API](../design/compositions/InterestApi.md), line 72.

```reaction
when RequestBoundary.request (path: "/explorations/history", requestId, session)
then
  Sessioning.current (session)
```

### InterestApi.StoryExploring.GetExplorationHistory#2

Authored path: `InterestApi.StoryExploring.GetExplorationHistory`.
- Covered by [Interest API](../design/compositions/InterestApi.md), line 62.
- Covered by [Interest API](../design/compositions/InterestApi.md), line 72.

```reaction
when Sessioning.current (session, user), asked by InterestApi.StoryExploring.GetExplorationHistory
where
  earlier, RequestBoundary.request (path: "/explorations/history", requestId, session)
then
  RequestBoundary.respond (explorations: former "explorations for a user" with (user), requestId)
```

### InterestApi.StoryExploring.GetStory

Authored path: `InterestApi.StoryExploring.GetStory`.
- Covered by [Interest API](../design/compositions/InterestApi.md), line 54.
- Covered by [Interest API](../design/compositions/InterestApi.md), line 70.

```reaction
when RequestBoundary.request (path: "/stories/get", requestId, session, story)
then
  Sessioning.current (session)
```

### InterestApi.StoryExploring.GetStory#2

Authored path: `InterestApi.StoryExploring.GetStory`.
- Covered by [Interest API](../design/compositions/InterestApi.md), line 54.
- Covered by [Interest API](../design/compositions/InterestApi.md), line 70.

```reaction
when Sessioning.current (session, user), asked by InterestApi.StoryExploring.GetStory
where
  earlier, RequestBoundary.request (path: "/stories/get", requestId, session, story)
then
  StoryGeneration.getStory (story, user)
```

### InterestApi.StoryExploring.GetStory#3

Authored path: `InterestApi.StoryExploring.GetStory`.
- Covered by [Interest API](../design/compositions/InterestApi.md), line 54.
- Covered by [Interest API](../design/compositions/InterestApi.md), line 70.

```reaction
when StoryGeneration.getStory (story, user, chapters), asked by InterestApi.StoryExploring.GetStory#2
where
  earlier, RequestBoundary.request (path: "/stories/get", requestId, session, story)
then
  RequestBoundary.respond (chapters, requestId)
```

### InterestApi.StoryExploring.StartStory

Authored path: `InterestApi.StoryExploring.StartStory`.
- Covered by [Interest API](../design/compositions/InterestApi.md), line 41.
- Covered by [Interest API](../design/compositions/InterestApi.md), line 69.

```reaction
when RequestBoundary.request (activity, path: "/stories/start", requestId, session)
then
  Sessioning.current (session)
```

### InterestApi.StoryExploring.StartStory#2

Authored path: `InterestApi.StoryExploring.StartStory`.
- Covered by [Interest API](../design/compositions/InterestApi.md), line 41.
- Covered by [Interest API](../design/compositions/InterestApi.md), line 69.

```reaction
when Sessioning.current (session, user), asked by InterestApi.StoryExploring.StartStory
then
  Account.getProfile (user)
```

### InterestApi.StoryExploring.StartStory#3

Authored path: `InterestApi.StoryExploring.StartStory`.
- Covered by [Interest API](../design/compositions/InterestApi.md), line 41.
- Covered by [Interest API](../design/compositions/InterestApi.md), line 69.

```reaction
when Account.getProfile (user, about), asked by InterestApi.StoryExploring.StartStory#2
where
  earlier, RequestBoundary.request (activity, path: "/stories/start", requestId, session)
then
  StoryGeneration.generateStory (activity, context: about, user)
```

### InterestApi.StoryExploring.StartStory#4

Authored path: `InterestApi.StoryExploring.StartStory`.
- Covered by [Interest API](../design/compositions/InterestApi.md), line 41.
- Covered by [Interest API](../design/compositions/InterestApi.md), line 69.

```reaction
when StoryGeneration.generateStory (activity, context: about, user, chapter, story), asked by InterestApi.StoryExploring.StartStory#3
where
  earlier, RequestBoundary.request (activity, path: "/stories/start", requestId, session)
then
  RequestBoundary.respond (chapter, requestId, story)
```

### Reflecting.CreateJournal

Authored path: `Reflecting.CreateJournal`.
- Covered by [Reflecting](../design/compositions/Reflecting.md), line 6.
- Covered by [Reflecting](../design/compositions/Reflecting.md), line 9.

```reaction
when RequestBoundary.request (path: "/reflecting/createjournal", requestId, session)
then
  Sessioning.current (session)
```

### Reflecting.CreateJournal#2

Authored path: `Reflecting.CreateJournal`.
- Covered by [Reflecting](../design/compositions/Reflecting.md), line 6.
- Covered by [Reflecting](../design/compositions/Reflecting.md), line 9.

```reaction
when Sessioning.current (session, user), asked by Reflecting.CreateJournal
then
  Reflecting.createJournal (user)
```

### Reflecting.CreateJournal#3

Authored path: `Reflecting.CreateJournal`.
- Covered by [Reflecting](../design/compositions/Reflecting.md), line 6.
- Covered by [Reflecting](../design/compositions/Reflecting.md), line 9.

```reaction
when Reflecting.createJournal (user, journal), asked by Reflecting.CreateJournal#2
where
  earlier, RequestBoundary.request (path: "/reflecting/createjournal", requestId, session)
then
  RequestBoundary.respond (journal, requestId)
```

### Reflecting.Edit

Authored path: `Reflecting.Edit`.
- Covered by [Reflecting](../design/compositions/Reflecting.md), line 19.
- Covered by [Reflecting](../design/compositions/Reflecting.md), line 22.

```reaction
when RequestBoundary.request (chapter, path: "/reflecting/edit", requestId, session, story, text)
then
  Sessioning.current (session)
```

### Reflecting.Edit#2

Authored path: `Reflecting.Edit`.
- Covered by [Reflecting](../design/compositions/Reflecting.md), line 19.
- Covered by [Reflecting](../design/compositions/Reflecting.md), line 22.

```reaction
when Sessioning.current (session, user), asked by Reflecting.Edit
where
  earlier, RequestBoundary.request (chapter, path: "/reflecting/edit", requestId, session, story, text)
then
  Reflecting.edit (chapter, story, text, user)
```

### Reflecting.Edit#3

Authored path: `Reflecting.Edit`.
- Covered by [Reflecting](../design/compositions/Reflecting.md), line 19.
- Covered by [Reflecting](../design/compositions/Reflecting.md), line 22.

```reaction
when Reflecting.edit (chapter, story, text, user, page), asked by Reflecting.Edit#2
where
  earlier, RequestBoundary.request (chapter, path: "/reflecting/edit", requestId, session, story, text)
then
  RequestBoundary.respond (page, requestId)
```

### Reflecting.GetJournal

Authored path: `Reflecting.GetJournal`.
- Covered by [Reflecting](../design/compositions/Reflecting.md), line 32.
- Covered by [Reflecting](../design/compositions/Reflecting.md), line 35.

```reaction
when RequestBoundary.request (path: "/reflecting/getjournal", requestId, session)
then
  Sessioning.current (session)
```

### Reflecting.GetJournal#2

Authored path: `Reflecting.GetJournal`.
- Covered by [Reflecting](../design/compositions/Reflecting.md), line 32.
- Covered by [Reflecting](../design/compositions/Reflecting.md), line 35.

```reaction
when Sessioning.current (session, user), asked by Reflecting.GetJournal
then
  Reflecting.getJournal (user)
```

### Reflecting.GetJournal#3

Authored path: `Reflecting.GetJournal`.
- Covered by [Reflecting](../design/compositions/Reflecting.md), line 32.
- Covered by [Reflecting](../design/compositions/Reflecting.md), line 35.

```reaction
when Reflecting.getJournal (user, pages), asked by Reflecting.GetJournal#2
where
  earlier, RequestBoundary.request (path: "/reflecting/getjournal", requestId, session)
then
  RequestBoundary.respond (pages, requestId)
```

### Reflecting.Read

Authored path: `Reflecting.Read`.
- Covered by [Reflecting](../design/compositions/Reflecting.md), line 25.
- Covered by [Reflecting](../design/compositions/Reflecting.md), line 29.

```reaction
when RequestBoundary.request (path: "/reflecting/read", requestId, session, story)
then
  Sessioning.current (session)
```

### Reflecting.Read#2

Authored path: `Reflecting.Read`.
- Covered by [Reflecting](../design/compositions/Reflecting.md), line 25.
- Covered by [Reflecting](../design/compositions/Reflecting.md), line 29.

```reaction
when Sessioning.current (session, user), asked by Reflecting.Read
where
  earlier, RequestBoundary.request (path: "/reflecting/read", requestId, session, story)
then
  Reflecting.read (story, user)
```

### Reflecting.Read#3

Authored path: `Reflecting.Read`.
- Covered by [Reflecting](../design/compositions/Reflecting.md), line 25.
- Covered by [Reflecting](../design/compositions/Reflecting.md), line 29.

```reaction
when Reflecting.read (story, user, page), asked by Reflecting.Read#2
where
  earlier, RequestBoundary.request (path: "/reflecting/read", requestId, session, story)
then
  RequestBoundary.respond (page, requestId)
```

### Reflecting.Write

Authored path: `Reflecting.Write`.
- Covered by [Reflecting](../design/compositions/Reflecting.md), line 12.
- Covered by [Reflecting](../design/compositions/Reflecting.md), line 16.

```reaction
when RequestBoundary.request (chapter, path: "/reflecting/write", requestId, session, story, text)
then
  Sessioning.current (session)
```

### Reflecting.Write#2

Authored path: `Reflecting.Write`.
- Covered by [Reflecting](../design/compositions/Reflecting.md), line 12.
- Covered by [Reflecting](../design/compositions/Reflecting.md), line 16.

```reaction
when Sessioning.current (session, user), asked by Reflecting.Write
where
  earlier, RequestBoundary.request (chapter, path: "/reflecting/write", requestId, session, story, text)
then
  Reflecting.write (chapter, story, text, user)
```

### Reflecting.Write#3

Authored path: `Reflecting.Write`.
- Covered by [Reflecting](../design/compositions/Reflecting.md), line 12.
- Covered by [Reflecting](../design/compositions/Reflecting.md), line 16.

```reaction
when Reflecting.write (chapter, story, text, user, page), asked by Reflecting.Write#2
where
  earlier, RequestBoundary.request (chapter, path: "/reflecting/write", requestId, session, story, text)
then
  RequestBoundary.respond (page, requestId)
```

### Sessions.CurrentAccount.CurrentUser

Authored path: `Sessions.CurrentAccount.CurrentUser`.
- Covered by [Sessions](../design/compositions/Sessions.md), line 17.
- Covered by [Sessions](../design/compositions/Sessions.md), line 21.

```reaction
when RequestBoundary.request (path: "/auth/current", requestId, session)
then
  Sessioning.current (session)
```

### Sessions.CurrentAccount.CurrentUser#2

Authored path: `Sessions.CurrentAccount.CurrentUser`.
- Covered by [Sessions](../design/compositions/Sessions.md), line 17.
- Covered by [Sessions](../design/compositions/Sessions.md), line 21.

```reaction
when Sessioning.current (session, user: account), asked by Sessions.CurrentAccount.CurrentUser
where
  earlier, RequestBoundary.request (path: "/auth/current", requestId, session)
then
  RequestBoundary.respond (account, requestId)
```

### Sessions.EnteringApplication.Register

Authored path: `Sessions.EnteringApplication.Register`.
- Covered by [Sessions](../design/compositions/Sessions.md), line 7.
- Covered by [Sessions](../design/compositions/Sessions.md), line 13.

```reaction
when RequestBoundary.request (password, path: "/auth/register", requestId, username)
then
  Authenticating.register (password, username)
```

### Sessions.EnteringApplication.Register#2

Authored path: `Sessions.EnteringApplication.Register`.
- Covered by [Sessions](../design/compositions/Sessions.md), line 7.
- Covered by [Sessions](../design/compositions/Sessions.md), line 13.

```reaction
when Authenticating.register (password, username, account), asked by Sessions.EnteringApplication.Register
then
  Sessioning.start (user: account)
```

### Sessions.EnteringApplication.Register#3

Authored path: `Sessions.EnteringApplication.Register`.
- Covered by [Sessions](../design/compositions/Sessions.md), line 7.
- Covered by [Sessions](../design/compositions/Sessions.md), line 13.

```reaction
when Sessioning.start (user: account, expiresAt, session), asked by Sessions.EnteringApplication.Register#2
where
  earlier, RequestBoundary.request (password, path: "/auth/register", requestId, username)
then
  RequestBoundary.respond (account, expiresAt, requestId, session)
```

### Sessions.EnteringApplication.SignIn

Authored path: `Sessions.EnteringApplication.SignIn`.
- Covered by [Sessions](../design/compositions/Sessions.md), line 8.
- Covered by [Sessions](../design/compositions/Sessions.md), line 14.

```reaction
when RequestBoundary.request (password, path: "/auth/sign-in", requestId, username)
then
  Authenticating.authenticate (password, username)
```

### Sessions.EnteringApplication.SignIn#2

Authored path: `Sessions.EnteringApplication.SignIn`.
- Covered by [Sessions](../design/compositions/Sessions.md), line 8.
- Covered by [Sessions](../design/compositions/Sessions.md), line 14.

```reaction
when Authenticating.authenticate (password, username, account), asked by Sessions.EnteringApplication.SignIn
then
  Sessioning.start (user: account)
```

### Sessions.EnteringApplication.SignIn#3

Authored path: `Sessions.EnteringApplication.SignIn`.
- Covered by [Sessions](../design/compositions/Sessions.md), line 8.
- Covered by [Sessions](../design/compositions/Sessions.md), line 14.

```reaction
when Sessioning.start (user: account, expiresAt, session), asked by Sessions.EnteringApplication.SignIn#2
where
  earlier, RequestBoundary.request (password, path: "/auth/sign-in", requestId, username)
then
  RequestBoundary.respond (account, expiresAt, requestId, session)
```

### Sessions.LeavingApplication.SignOut

Authored path: `Sessions.LeavingApplication.SignOut`.
- Covered by [Sessions](../design/compositions/Sessions.md), line 24.
- Covered by [Sessions](../design/compositions/Sessions.md), line 28.

```reaction
when RequestBoundary.request (path: "/auth/sign-out", requestId, session)
then
  Sessioning.end (session)
```

### Sessions.LeavingApplication.SignOut#2

Authored path: `Sessions.LeavingApplication.SignOut`.
- Covered by [Sessions](../design/compositions/Sessions.md), line 24.
- Covered by [Sessions](../design/compositions/Sessions.md), line 28.

```reaction
when Sessioning.end (session, ended), asked by Sessions.LeavingApplication.SignOut
where
  earlier, RequestBoundary.request (path: "/auth/sign-out", requestId, session)
then
  RequestBoundary.respond (ended, requestId)
```

## Endpoint input contracts

Before recording an action ask, the boundary rejects a body that is not an
object or lacks a required key. The response uses `INVALID_INPUT` and names
the path or missing key. A declared default fills an absent key. Endpoints
not listed here have no explicit input contract.

- `/account/create` — requires `session`, `name`, `about`
- `/account/profile` — requires `session`
- `/account/update` — requires `session`, `name`, `about`
- `/auth/current` — requires `session`
- `/auth/register` — requires `username`, `password`
- `/auth/sign-in` — requires `username`, `password`
- `/auth/sign-out` — requires `session`
- `/explorations/history` — requires `session`
- `/interests/activities` — requires `session`
- `/interests/preference` — requires `session`, `subject`, `status`
- `/interests/preferences` — requires `session`
- `/interests/topics` — requires `session`
- `/reflecting/createjournal` — requires `session`
- `/reflecting/edit` — requires `session`, `story`, `chapter`, `text`
- `/reflecting/getjournal` — requires `session`
- `/reflecting/read` — requires `session`, `story`
- `/reflecting/write` — requires `session`, `story`, `chapter`, `text`
- `/stories/continue` — requires `session`, `story`, `answer`
- `/stories/get` — requires `session`, `story`
- `/stories/start` — requires `session`, `activity`

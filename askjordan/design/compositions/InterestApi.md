
# Interest API

The Interest API lets authenticated students browse activities,
record interests, and explore personalized stories.

Every endpoint requires a valid session. The session is resolved
through Sessioning.current to obtain the authenticated user.

The frontend cannot provide a different user identifier to
access another student's data.

## Browsing interests

An authenticated student
[retrieves the catalog topics](reaction:InterestApi.InterestBrowsing.GetTopics)
through the [catalog topics](former:InterestApi.InterestBrowsing.TopicsList).

An authenticated student
[retrieves the catalog activities](reaction:InterestApi.InterestBrowsing.GetActivities)
through the [catalog activities](former:InterestApi.InterestBrowsing.ActivitiesList).

An authenticated student
[saves or updates a preference](reaction:InterestApi.InterestBrowsing.SetPreference)
for an existing topic or activity.

The authenticated student
[retrieves their preferences](reaction:InterestApi.InterestBrowsing.GetPreferences)
through the [preferences for a user](former:InterestApi.InterestBrowsing.PreferencesList).

```endpoints
InterestApi.InterestBrowsing.GetTopics at /interests/topics
InterestApi.InterestBrowsing.GetActivities at /interests/activities
InterestApi.InterestBrowsing.SetPreference at /interests/preference
InterestApi.InterestBrowsing.GetPreferences at /interests/preferences
```

## Exploring stories

An authenticated student
[starts a story](reaction:InterestApi.StoryExploring.StartStory)
for a selected activity.

The student's profile description is retrieved from Account
and supplied as the story's personalization context.

When a story is generated, the existing
StoryCreatedStartsExploration reaction starts its exploration.

A student
[retrieves their story](reaction:InterestApi.StoryExploring.GetStory)
using StoryGeneration.getStory.

A student
[retrieves their list of stories](reaction:InterestApi.StoryExploring.GetStories)
using StoryGeneration.getStories.

Each story summary includes the original Activity identifier.
This allows the frontend to reopen a story without generating
a duplicate.

A student
[continues their story](reaction:InterestApi.StoryExploring.ContinueStory)
by answering its current question.

A student
[retrieves their exploration history](reaction:InterestApi.StoryExploring.GetExplorationHistory)
through the [explorations for a user](former:InterestApi.StoryExploring.ExplorationHistory).

Only stories and explorations belonging to the authenticated
student can be retrieved or changed.

```endpoints
InterestApi.StoryExploring.StartStory at /stories/start
InterestApi.StoryExploring.GetStory at /stories/get
InterestApi.StoryExploring.GetStories at /stories/list
InterestApi.StoryExploring.ContinueStory at /stories/continue
InterestApi.StoryExploring.GetExplorationHistory at /explorations/history
```

## Persistence

InterestCollection, StoryGeneration, and ExplorationTracking
remain independent concepts.

The application persistence adapter stores and restores
their state in MongoDB.

The state is restored before catalog initialization, preserving
existing Topic, Activity, Story, and Exploration identifiers.

The browser retrieves saved preferences and story summaries
after authentication. It does not use browser-local storage
as the authoritative source for student data.

## Alpha scope

For Alpha, students can browse a predefined catalog, save
interests, create and continue stories, and reopen stories
across application restarts.

Reflection remains a separate concept integration.

The frontend sends session cookies with requests and
does not choose the account identifier.

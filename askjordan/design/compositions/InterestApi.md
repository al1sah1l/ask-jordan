
# Interest API

The Interest API lets authenticated students browse activities,
record their interests, and explore stories.

Every endpoint requires a valid session. The session is resolved
through Sessioning.current to obtain the authenticated user.

A frontend client cannot provide a different user identifier
to perform actions on another student's behalf.

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

The frontend does not supply the user's identity or
personalization context.

When a story is successfully generated, the existing
StoryCreatedStartsExploration reaction starts its exploration.

A student
[retrieves their story](reaction:InterestApi.StoryExploring.GetStory)
using StoryGeneration.getStory.

A student
[continues their story](reaction:InterestApi.StoryExploring.ContinueStory)
by answering its current question.

A student
[retrieves their exploration history](reaction:InterestApi.StoryExploring.GetExplorationHistory)
through the [explorations for a user](former:InterestApi.StoryExploring.ExplorationHistory).

Only stories and explorations associated with the
authenticated user are accessible.

```endpoints
InterestApi.StoryExploring.StartStory at /stories/start
InterestApi.StoryExploring.GetStory at /stories/get
InterestApi.StoryExploring.ContinueStory at /stories/continue
InterestApi.StoryExploring.GetExplorationHistory at /explorations/history
```

## Alpha scope

For Alpha, the student can browse a predefined catalog,
save their interests, and start and read a story.

The story and exploration remain separate concepts.

The reflection interface is connected by the Reflecting
concept owner.

The frontend sends session cookies with each request
and does not choose the account identifier.

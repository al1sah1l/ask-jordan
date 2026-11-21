
# InterestGeneration

## Purpose

Suggest concrete activities that users may want to explore based on their interests, available activities, and connections between activities and topics.

## Principle

George expresses an interest in Music. When suggestions are generated, related activities such as Songwriting may be prioritized. George can dismiss a suggestion without changing his preferences. Dismissed activities and activities he has already started are excluded from future suggestions. Suggestions for different users remain independent.

## Types

```types
external User
  The user receiving suggestions.

external Activity
  An activity available in InterestCollection.

opaque PreferenceCatalog
  A collection of preference records supplied by InterestCollection.

opaque ActivityCatalog
  A collection of available activity records.

opaque ConnectionCatalog
  A collection of relationships between topics and activities.

opaque ActivityIds
  A collection of activity identifiers already explored or started.

opaque SuggestionIds
  The identifiers of newly generated suggestions.

opaque Status
  A suggestion status, either pending or dismissed.
```

## State

```state
a set of Suggestions with
  a user User
  an activity Activity
  a status Status
  unique user and activity

Rule: Each Suggestion has status pending or dismissed.
Rule: A dismissed Suggestion is not returned as pending.
Rule: Each user has at most one stored Suggestion per Activity.
```

## Actions

```actions
generateSuggestions (user: User, preferences: PreferenceCatalog, activities: ActivityCatalog, connections: ConnectionCatalog, startedActivities: ActivityIds) : returns (suggestions: SuggestionIds)
  where the supplied activity catalog is empty
  then
    refuses NO_ACTIVITIES_AVAILABLE "No activities are available for suggestions."
  where the supplied activity catalog is not empty
  then
    rank available activities using the supplied preferences and connections
    exclude dismissed activities and activities already started
    replace the user's existing pending Suggestions
    retain the user's dismissed Suggestions
    add up to three pending Suggestions for eligible activities
    returns suggestions

dismissSuggestion (user: User, suggestion: Suggestion) : returns (suggestion: Suggestion)
  where the Suggestion does not exist, belongs to another user, or is not pending
  then
    refuses SUGGESTION_NOT_FOUND "No pending suggestion exists for this user."
  where the Suggestion exists, belongs to user, and is pending
  then
    change its status to dismissed
    returns suggestion
```

## Queries

```queries
_getSuggestions (user: User) : many (suggestion: Suggestion, user: User, activity: Activity, status: Status)
  Returns all pending Suggestions belonging to user.
  Returns no rows if the user has no pending Suggestions.
  Orders results by activity identifier.
```

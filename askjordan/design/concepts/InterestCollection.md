
# InterestCollection

## Purpose

Organize broad topics, specific activities, connections between them, and users' expressed preferences so they can discover directions they might enjoy exploring.

## Principle

George is interested in Music and discovers Songwriting, an activity connected to both Music and Creative Writing. He marks Songwriting as curious and later changes it to interested. His updated preference replaces the previous one without affecting other users. Topics and activities remain available even if George has not expressed a preference for them.

## Types

```types
external User
  A user who can express preferences.

opaque Subject
  The identifier of an existing Topic or Activity.

opaque Status
  One of "interested", "curious", or "notInterested".
```

## State

```state
a set of Topics with
  a unique name String
  a description String

a set of Activities with
  a unique name String
  a description String

a set of Connections with
  a first Subject
  a second Subject

a set of Preferences with
  a user User
  a subject Subject
  a status Status
  unique user and subject

Rule: Each Connection joins a Topic to an Activity or two different Activities.
Rule: Connections are undirected and duplicate pairs are not allowed.
Rule: Each Preference refers to an existing Topic or Activity.
Rule: Preference status is interested, curious, or notInterested.
```

## Actions

```actions
registerTopic (name: String, description: String) : returns (topic: Topic)
  where name is blank
  then
    refuses INVALID_CATALOG_ENTRY "A topic name cannot be blank."
  where a Topic with this name already exists, ignoring case
  then
    refuses CATALOG_ENTRY_EXISTS "This topic already exists."
  where name is not blank and no Topic with this name exists
  then
    add a new Topic with name and description
    returns topic

registerActivity (name: String, description: String, topics: Topics) : returns (activity: Activity)
  where name is blank or topics is empty
  then
    refuses INVALID_CATALOG_ENTRY "An activity needs a name and at least one topic."
  where an Activity with this name already exists, ignoring case
  then
    refuses CATALOG_ENTRY_EXISTS "This activity already exists."
  where at least one supplied Topic does not exist
  then
    refuses CATALOG_ENTRY_NOT_FOUND "One of the topics does not exist."
  where name is not blank, topics is not empty, all Topics exist, and no Activity with this name exists
  then
    add a new Activity with name and description
    add a Connection between the Activity and every distinct supplied Topic
    returns activity

connectActivities (activity1: Activity, activity2: Activity) : returns (connection: Connection)
  where either Activity does not exist
  then
    refuses CATALOG_ENTRY_NOT_FOUND "Both activities must exist."
  where activity1 and activity2 are the same
  then
    refuses INVALID_CATALOG_ENTRY "An activity cannot connect to itself."
  where a Connection between activity1 and activity2 already exists
  then
    refuses CONNECTION_EXISTS "The connection already exists."
  where both Activities exist, are different, and are not connected
  then
    add a new undirected Connection between activity1 and activity2
    returns connection

setPreference (user: User, subject: Subject, status: Status) : returns (preference: Preference)
  where subject does not identify an existing Topic or Activity
  then
    refuses CATALOG_ENTRY_NOT_FOUND "The topic or activity does not exist."
  where status is not interested, curious, or notInterested
  then
    refuses INVALID_PREFERENCE "Invalid preference status."
  where subject exists and status is valid
  then
    create a Preference for user and subject if none exists
    otherwise update the existing Preference's status
    returns preference
```

## Queries

```queries
_topics () : many (topic: Topic, name: String, description: String)
  Returns all registered Topics.
  Returns no rows if the catalog contains no Topics.
  Orders results alphabetically by name.

_activities () : many (activity: Activity, name: String, description: String)
  Returns all registered Activities.
  Returns no rows if the catalog contains no Activities.
  Orders results alphabetically by name.

_connections () : many (connection: Connection, first: Subject, second: Subject)
  Returns all Connections between Topics and Activities or between Activities.
  Returns no rows if no Connections exist.
  Orders results by connection identifier.

_preferences (user: User) : many (preference: Preference, user: User, subject: Subject, status: Status)
  Returns all Preferences belonging to user.
  Returns no rows if the user has no Preferences.
  Orders results by subject identifier.

_related (subject: Subject) : many (subject: Subject)
  Returns the identifiers of all Topics and Activities directly connected to subject.
  Returns no rows if subject is unknown or has no connections.
  Removes duplicates and orders results by subject identifier.
```

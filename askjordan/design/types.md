# Ask Jordan application types

A user is the account Authenticating returned. A session, a profile, and an avatar use that account. InterestCollection owns activities. StoryGeneration owns stories, and ExplorationTracking uses those stories. Items are not created by any concept yet.

```instances
instantiate Authenticating

instantiate Sessioning with
  User is Authenticating.Account

instantiate Account with
  User is Authenticating.Account

instantiate AvatarCustomizing with
  User is Authenticating.Account

instantiate InterestCollection with
  User is Authenticating.Account

instantiate ExplorationTracking with
  User is Authenticating.Account
  Story is StoryGeneration.Story

instantiate InterestGeneration with
  User is Authenticating.Account
  Activity is InterestCollection.Activity

instantiate StoryGeneration with
  User is Authenticating.Account
  Activity is InterestCollection.Activity

instantiate Reflecting with
  User is Authenticating.Account
  Story is StoryGeneration.Story
  Chapter is StoryGeneration.Chapter
```

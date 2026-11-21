# Ask Jordan Application Types

Ask Jordan helps students explore interests through activities and interactive stories. Users can express preferences, receive activity suggestions, generate stories, and track the stories they start and complete.

The application uses a shared user identity. InterestCollection owns the activity catalog. StoryGeneration owns stories, and ExplorationTracking refers to those same stories rather than introducing separate story identities.

```types
concrete User
  A student using Ask Jordan.
```

```instances
instantiate InterestCollection with
  User is User

instantiate ExplorationTracking with
  User is User
  Story is StoryGeneration.Story

instantiate InterestGeneration with
  User is User
  Activity is InterestCollection.Activity

instantiate StoryGeneration with
  User is User
  Activity is InterestCollection.Activity
```

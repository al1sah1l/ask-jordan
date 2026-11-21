
# Ask Jordan Application Types

Ask Jordan helps students explore interests through activities and interactive stories. Users can express preferences and track the stories they have started or completed.

```types
concrete User
  A student using Ask Jordan.

concrete Story
  An interactive story explored by a student.
```

```instances
instantiate InterestCollection with
  User is User

instantiate ExplorationTracking with
  User is User
  Story is Story
```

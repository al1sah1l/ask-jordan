# Account

## Purpose

Allow users to describe themselves so that stories can reflect their background without requiring them to enter the same information repeatedly.

## Principle

A user creates a profile with a display name and optional description. They can retrieve and update that information later. A second profile for the same user is refused, and a blank name is refused. Interests are not stored here.

## Types

```types
external User
  The account Authenticating returned.
```

## State

```state
a set of Profiles with
  a unique owner User
  a name String
  an about String
```

## Actions

```actions
createAccount (user: User, name: String, about: String) : returns (profile: Profile)
  where name is blank
  then
    refuses BLANK_NAME "A display name is required."
  where user already has a profile
  then
    refuses PROFILE_EXISTS "That user already has a profile."
  where name is not blank and user has no profile
  then
    add a Profile for user with name and about
    returns profile

updateProfile (user: User, name: String, about: String) : returns (profile: Profile)
  where user has no profile
  then
    refuses NO_PROFILE "That user has no profile."
  where name is blank
  then
    refuses BLANK_NAME "A display name is required."
  where user has a profile and name is not blank
  then
    replace the profile's name and about
    returns profile

getProfile (user: User) : returns (profile: Profile, name: String, about: String)
  where user has no profile
  then
    refuses NO_PROFILE "That user has no profile."
  where user has a profile
  then
    returns profile, name, about
```

## Queries

```queries
```

# Sessioning

## Purpose

Keep a short-lived session for a user, so temporary access can end without changing that user's identity.

## Principle

A session is started for a user. Until it expires, current resolves the session to that user. Ending the session makes it unknown, so another current call is refused. An invented or expired session is refused in the same way.

## Types

```types
external User
  The account a session stands for.
```

## State

```state
a set of Sessions with
  a user User
  an expiresAt DateTime
```

## Actions

```actions
start (user: User) : returns (session: Session, expiresAt: DateTime)
  where true
  then
    delete every expired session
    add a new opaque session for user expiring 24 hours from now
    returns session, expiresAt

current (session: Session) : returns (user: User)
  where session is unknown, ended, or expired
  then
    delete the session if it is expired
    refuses UNKNOWN_SESSION "You are not signed in, or your session has ended."
  where session is active
  then
    returns user

end (session: Session) : returns (ended: Flag)
  where session is unknown, ended, or expired
  then
    delete the session if it is expired
    refuses UNKNOWN_SESSION "You are not signed in, or your session has ended."
  where session is active
  then
    delete session
    returns ended
```

## Queries

```queries
```

# Sessions

Sessions connect an accepted username and password to an opaque session. Later
requests carry that session, and `current` turns it back into the account
Authenticating returned, so a caller cannot choose which user they are.

[Registering creates an account and starts a session](reaction:Sessions.EnteringApplication.Register)
for it, and [signing in checks the password and starts a new session](reaction:Sessions.EnteringApplication.SignIn).
In both cases the session's user is the account that came back from
Authenticating.

```endpoints
Sessions.EnteringApplication.Register at /auth/register
Sessions.EnteringApplication.SignIn at /auth/sign-in
```

An [active session resolves to its account](reaction:Sessions.CurrentAccount.CurrentUser).
An unknown, ended, or expired session is refused.

```endpoints
Sessions.CurrentAccount.CurrentUser at /auth/current
```

[Signing out ends the session](reaction:Sessions.LeavingApplication.SignOut),
after which it no longer grants access to anything.

```endpoints
Sessions.LeavingApplication.SignOut at /auth/sign-out
```

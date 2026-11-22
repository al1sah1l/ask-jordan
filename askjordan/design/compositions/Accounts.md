# Accounts

A profile belongs to the account a session resolves to. The caller sends a
display name and a description. The description may be empty. The caller does
not choose which user the profile belongs to.

[Creating a profile stores that name and description](reaction:Accounts.Profile.Create).
A blank name is refused, and a second profile for the same account is refused.

```endpoints
Accounts.Profile.Create at /account/create
```

[Updating a profile replaces the name and description](reaction:Accounts.Profile.Update).
Updating is refused when the account has no profile.

```endpoints
Accounts.Profile.Update at /account/update
```

[Reading a profile returns the stored name and description](reaction:Accounts.Profile.Get).
Reading is refused when the account has no profile.

```endpoints
Accounts.Profile.Get at /account/profile
```

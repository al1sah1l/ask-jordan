# Authenticating

## Purpose

Establish an account from a username, an email address, and a password, so an identity claim alone cannot act as proof of identity.

## Principle

A user registers a username and email with a password. Another registration with the same username or the same email is refused. Signing in with the username and the wrong password is refused, and the correct password returns the account. A recovery token for that email can set a new password once; the link then stops working, and the old password no longer authenticates.

## Types

```types
opaque Secret
  A password verifier or token hash that includes no recoverable secret; its representation is the implementer's choice.
```

## State

```state
a set of Accounts with
  a unique username String
  a unique email String
  a passwordVerifier Secret

a set of Recoveries with
  a tokenHash Secret
  an account Account
  a createdAt DateTime
  an expiresAt DateTime
```

## Actions

```actions
register (username: String, email: String, password: String) : returns (account: Account)
  where username is not 3 to 32 letters, digits, underscores, or hyphens
  then
    refuses INVALID_USERNAME "A username must contain 3 to 32 letters, numbers, underscores, or hyphens."
  where email is not a valid email address
  then
    refuses INVALID_EMAIL "Enter a valid email address."
  where password is shorter than 8 characters or longer than 128 characters
  then
    refuses WEAK_PASSWORD "A password must contain 8 to 128 characters."
  where username is already registered
  then
    refuses USERNAME_TAKEN "That username is already registered."
  where email is already registered
  then
    refuses EMAIL_TAKEN "That email is already registered."
  where username, email, and password are accepted
  then
    add a new account with username, email, and a salted verifier derived from password
    returns account

authenticate (username: String, password: String) : returns (account: Account)
  where username is unknown or password does not verify
  then
    refuses INVALID_CREDENTIALS "The username or password is incorrect."
  where password verifies
  then
    returns account

requestRecovery (email: String) : returns (token: String)
  where email is not a valid email address
  then
    refuses INVALID_EMAIL "Enter a valid email address."
  where email is not registered, or a reset was just requested
  then
    returns token
  where email is registered
  then
    replace any previous reset for that account with a new single-use token that expires in 5 minutes
    returns token

resetPassword (token: String, password: String) : returns (account: Account)
  where token is unknown, expired, or already used
  then
    refuses INVALID_RECOVERY "That reset link is invalid or has expired."
  where password is shorter than 8 characters or longer than 128 characters
  then
    refuses WEAK_PASSWORD "A password must contain 8 to 128 characters."
  where token is valid and password is accepted
  then
    replace that account's password verifier and discard the token
    returns account
```

## Queries

```queries
```

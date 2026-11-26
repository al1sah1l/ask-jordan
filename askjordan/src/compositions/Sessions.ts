/**
 * Registering, signing in and out, and resolving the current user.
 *
 * Authenticating proves an account. Registering uses a username, email, and
 * password. Signing in uses the username and password. Sessioning holds an
 * opaque session for that user. Neither concept names the other; they meet here.
 */
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { concepts } from "../concepts.ts";

const { Authenticating, Sessioning } = concepts;

const Register = endpoint(
  "/auth/register",
  ({ username, email, password, account, session, expiresAt }) =>
    receive({ username, email, password })
      .then(Authenticating.register({ username, email, password }).responds({ account }))
      .then(Sessioning.start({ user: account }).responds({ session, expiresAt }))
      .then(respond({ account, session, expiresAt })),
  { input: { required: ["username", "email", "password"] } },
);

const SignIn = endpoint(
  "/auth/sign-in",
  ({ username, password, account, session, expiresAt }) =>
    receive({ username, password })
      .then(Authenticating.authenticate({ username, password }).responds({ account }))
      .then(Sessioning.start({ user: account }).responds({ session, expiresAt }))
      .then(respond({ account, session, expiresAt })),
  { input: { required: ["username", "password"] } },
);

const CurrentUser = endpoint(
  "/auth/current",
  ({ session, account }) =>
    receive({ session })
      .then(Sessioning.current({ session }).responds({ user: account }))
      .then(respond({ account })),
  { input: { required: ["session"] } },
);

const SignOut = endpoint(
  "/auth/sign-out",
  ({ session, ended }) =>
    receive({ session })
      .then(Sessioning.end({ session }).responds({ ended }))
      .then(respond({ ended })),
  { input: { required: ["session"] } },
);

export const composition = {
  EnteringApplication: { Register, SignIn },
  CurrentAccount: { CurrentUser },
  LeavingApplication: { SignOut },
};

/**
 * Creating, updating, and reading the signed-in user's profile.
 *
 * The session cookie is resolved to an account. That account is the profile's
 * owner. The caller sends a name and a description, not a user id.
 */
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { concepts } from "../concepts.ts";

const { Account, Sessioning } = concepts;

const Create = endpoint(
  "/account/create",
  ({ session, user, name, about, profile }) =>
    receive({ session, name, about })
      .then(Sessioning.current({ session }).responds({ user }))
      .then(Account.createAccount({ user, name, about }).responds({ profile }))
      .then(respond({ profile })),
  { input: { required: ["session", "name", "about"] } },
);

const Update = endpoint(
  "/account/update",
  ({ session, user, name, about, profile }) =>
    receive({ session, name, about })
      .then(Sessioning.current({ session }).responds({ user }))
      .then(Account.updateProfile({ user, name, about }).responds({ profile }))
      .then(respond({ profile })),
  { input: { required: ["session", "name", "about"] } },
);

const Get = endpoint(
  "/account/profile",
  ({ session, user, profile, name, about }) =>
    receive({ session })
      .then(Sessioning.current({ session }).responds({ user }))
      .then(Account.getProfile({ user }).responds({ profile, name, about }))
      .then(respond({ profile, name, about })),
  { input: { required: ["session"] } },
);

export const composition = {
  Profile: { Create, Update, Get },
};

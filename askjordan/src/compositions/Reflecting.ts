import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";

import { concepts } from "../concepts.ts";

const { Reflecting, Sessioning } = concepts;

const CreateJournal = endpoint(
  "/reflecting/createjournal",
  ({ session, user, journal }) =>
    receive({ session })
      .then(Sessioning.current({ session }).responds({ user }))
      .then(Reflecting.createJournal({ user }).responds({ journal }))
      .then(respond({ journal })),
  { input: { required: ["session"] } },
);

const Write = endpoint(
  "/reflecting/write",
  ({ session, user, story, chapter, text, page }) =>
    receive({ session, story, chapter, text })
      .then(Sessioning.current({ session }).responds({ user }))
      .then(
        Reflecting.write({
          user,
          story,
          chapter,
          text,
        }).responds({ page }),
      )
      .then(respond({ page })),
  {
    input: {
      required: ["session", "story", "chapter", "text"],
    },
  },
);

const Edit = endpoint(
  "/reflecting/edit",
  ({ session, user, story, chapter, text, page }) =>
    receive({ session, story, chapter, text })
      .then(Sessioning.current({ session }).responds({ user }))
      .then(
        Reflecting.edit({
          user,
          story,
          chapter,
          text,
        }).responds({ page }),
      )
      .then(respond({ page })),
  {
    input: {
      required: ["session", "story", "chapter", "text"],
    },
  },
);

const Read = endpoint(
  "/reflecting/read",
  ({ session, user, story, page }) =>
    receive({ session, story })
      .then(Sessioning.current({ session }).responds({ user }))
      .then(Reflecting.read({ user, story }).responds({ page }))
      .then(respond({ page })),
  { input: { required: ["session", "story"] } },
);

const GetJournal = endpoint(
  "/reflecting/getjournal",
  ({ session, user, pages }) =>
    receive({ session })
      .then(Sessioning.current({ session }).responds({ user }))
      .then(Reflecting.getJournal({ user }).responds({ pages }))
      .then(respond({ pages })),
  { input: { required: ["session"] } },
);

export const composition = {
  CreateJournal,
  Write,
  Edit,
  Read,
  GetJournal,
};
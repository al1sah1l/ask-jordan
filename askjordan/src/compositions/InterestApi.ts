
import {
  endpoint,
  receive,
  respond,
} from "@mit-sdg/sync-engine/boundary";

import {
  each,
  former,
} from "@mit-sdg/sync-engine/language";

import { concepts } from "../concepts.ts";

const {
  Sessioning,
  Account,
  InterestCollection,
  StoryGeneration,
  ExplorationTracking,
} = concepts;

// ---------- Response collections ----------

const TopicsList = former(
  "catalog topics",
  (_input, { topic, name, description }) =>
    each(
      InterestCollection._topics({}).is({
        topic,
        name,
        description,
      }),
    ).form({ topic, name, description }),
);

const ActivitiesList = former(
  "catalog activities",
  (_input, { activity, name, description }) =>
    each(
      InterestCollection._activities({}).is({
        activity,
        name,
        description,
      }),
    ).form({ activity, name, description }),
);

const PreferencesList = former(
  "preferences for a user",
  ({ user }, { preference, subject, status }) =>
    each(
      InterestCollection._preferences({ user }).is({
        preference,
        subject,
        status,
      }),
    ).form({ preference, subject, status }),
);

const ExplorationHistory = former(
  "explorations for a user",
  ({ user }, { exploration, story, status }) =>
    each(
      ExplorationTracking._history({ user }).is({
        exploration,
        story,
        status,
      }),
    ).form({ exploration, story, status }),
);

// ---------- Interest catalog endpoints ----------

const GetTopics = endpoint(
  "/interests/topics",
  ({ session, user }) =>
    receive({ session })
      .then(
        Sessioning.current({ session }).responds({
          user,
        }),
      )
      .then(
        respond({
          topics: TopicsList({}),
        }),
      ),
  { input: { required: ["session"] } },
);

const GetActivities = endpoint(
  "/interests/activities",
  ({ session, user }) =>
    receive({ session })
      .then(
        Sessioning.current({ session }).responds({
          user,
        }),
      )
      .then(
        respond({
          activities: ActivitiesList({}),
        }),
      ),
  { input: { required: ["session"] } },
);

// ---------- Interest preference endpoints ----------

const SetPreference = endpoint(
  "/interests/preference",
  ({ session, user, subject, status, preference }) =>
    receive({ session, subject, status })
      .then(
        Sessioning.current({ session }).responds({
          user,
        }),
      )
      .then(
        InterestCollection.setPreference({
          user,
          subject,
          status,
        }).responds({
          preference,
        }),
      )
      .then(respond({ preference })),
  {
    input: {
      required: ["session", "subject", "status"],
    },
  },
);

const GetPreferences = endpoint(
  "/interests/preferences",
  ({ session, user }) =>
    receive({ session })
      .then(
        Sessioning.current({ session }).responds({
          user,
        }),
      )
      .then(
        respond({
          preferences: PreferencesList({ user }),
        }),
      ),
  { input: { required: ["session"] } },
);

// ---------- Story endpoints ----------

const StartStory = endpoint(
  "/stories/start",
  ({ session, user, activity, about, story, chapter }) =>
    receive({ session, activity })
      .then(
        Sessioning.current({ session }).responds({
          user,
        }),
      )
      .then(
        Account.getProfile({ user }).responds({
          about,
        }),
      )
      .then(
        StoryGeneration.generateStory({
          user,
          activity,
          context: about,
        }).responds({
          story,
          chapter,
        }),
      )
      .then(respond({ story, chapter })),
  {
    input: {
      required: ["session", "activity"],
    },
  },
);

const GetStory = endpoint(
  "/stories/get",
  ({ session, user, story, chapters }) =>
    receive({ session, story })
      .then(
        Sessioning.current({ session }).responds({
          user,
        }),
      )
      .then(
        StoryGeneration.getStory({
          user,
          story,
        }).responds({
          chapters,
        }),
      )
      .then(respond({ chapters })),
  {
    input: {
      required: ["session", "story"],
    },
  },
);

const ContinueStory = endpoint(
  "/stories/continue",
  ({ session, user, story, answer, chapter }) =>
    receive({ session, story, answer })
      .then(
        Sessioning.current({ session }).responds({
          user,
        }),
      )
      .then(
        StoryGeneration.continueStory({
          user,
          story,
          answer,
        }).responds({
          chapter,
        }),
      )
      .then(respond({ chapter })),
  {
    input: {
      required: ["session", "story", "answer"],
    },
  },
);

// ---------- Exploration endpoints ----------

const GetExplorationHistory = endpoint(
  "/explorations/history",
  ({ session, user }) =>
    receive({ session })
      .then(
        Sessioning.current({ session }).responds({
          user,
        }),
      )
      .then(
        respond({
          explorations: ExplorationHistory({ user }),
        }),
      ),
  { input: { required: ["session"] } },
);

export const composition = {
  InterestBrowsing: {
    TopicsList,
    ActivitiesList,
    PreferencesList,
    GetTopics,
    GetActivities,
    SetPreference,
    GetPreferences,
  },

  StoryExploring: {
    StartStory,
    GetStory,
    ContinueStory,
    ExplorationHistory,
    GetExplorationHistory,
  },
};

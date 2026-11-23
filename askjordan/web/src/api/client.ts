
export interface Activity {
  activity: string;
  name: string;
  description: string;
}

export interface Topic {
  topic: string;
  name: string;
  description: string;
}

export interface Chapter {
  position: number;
  text: string;
  question?: string;
  answer?: string;
  suggestedActivity?: string;
}

export interface Exploration {
  exploration: string;
  story: string;
  status: string;
}

export interface Preference {
  preference: string;
  subject: string;
  status: string;
}

async function post<T>(
  path: string,
  body: Record<string, unknown> = {},
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const result: unknown = await response.json();

  if (!response.ok) {
    const message =
      typeof result === "object" &&
      result !== null &&
      "error" in result
        ? String(result.error)
        : `HTTP ${response.status}`;

    throw new Error(message);
  }

  return result as T;
}

export const api = {
  register(username: string, password: string) {
    return post<{ account: string }>(
      "/auth/register",
      { username, password },
    );
  },

  signIn(username: string, password: string) {
    return post<{ account: string }>(
      "/auth/sign-in",
      { username, password },
    );
  },

  currentUser() {
    return post<{ account: string }>("/auth/current");
  },

  signOut() {
    return post<unknown>("/auth/sign-out");
  },

  getTopics() {
    return post<{ topics: Topic[] }>(
      "/interests/topics",
    );
  },

  getActivities() {
    return post<{ activities: Activity[] }>(
      "/interests/activities",
    );
  },

  getPreferences() {
    return post<{ preferences: Preference[] }>(
      "/interests/preferences",
    );
  },

  setPreference(subject: string, status: string) {
    return post<{ preference: string }>(
      "/interests/preference",
      { subject, status },
    );
  },

  startStory(activity: string) {
    return post<{ story: string; chapter: string }>(
      "/stories/start",
      { activity },
    );
  },

  getStory(story: string) {
    return post<{ chapters: Chapter[] }>(
      "/stories/get",
      { story },
    );
  },

  continueStory(story: string, answer: string) {
    return post<{ chapter: string }>(
      "/stories/continue",
      { story, answer },
    );
  },

  getExplorations() {
    return post<{ explorations: Exploration[] }>(
      "/explorations/history",
    );
  },
};


export interface Profile {
  profile: string;
  name: string;
  about: string;
}

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
  chapter: string;
  story: string;
  position: number;
  text: string;
  question?: string;
  choices?: string[];
  answer?: string;
  suggestedActivity?: string;
}

export interface ReflectionLimits {
  maxImages: number;
  maxImageBytes: number;
  maxTextCharacters: number;
  acceptedMimeTypes: string[];
  requestBodyBytes: number;
}

export interface WorkEntry {
  page: string;
  story: string;
  chapter: string;
  text: string;
  images: string[];
}

export interface WorkResponse {
  entry: WorkEntry | null;
  limits: ReflectionLimits;
}

export interface StorySummary {
  story: string;
  user: string;
  activity: string;
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

export class ApiError extends Error {
  constructor(public readonly code: string, public readonly status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export function friendlyError(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function messageFor(code: string, status: number): string {
  if (status === 401) return "Your session has ended or your sign-in details were not accepted. Please sign in again.";
  const messages: Record<string, string> = {
    INVALID_REQUEST: "Please check the details you entered and try again.",
    INVALID_INPUT: "Some required details are missing. Please check the form and try again.",
    CONFLICT: "This already exists. Reload your saved information or choose another username.",
    NOT_FOUND: "We couldn't find the saved information. Please try loading it again.",
    NO_PROFILE: "Please create your profile before starting an adventure.",
    BLANK_NAME: "Please enter a display name.",
    INVALID_STORY_ANSWER: "Write a short answer before continuing.",
    STORY_CANNOT_CONTINUE: "This story has changed. Reload it to see your saved chapters.",
    STORY_ALREADY_EXISTS: "You already have this adventure. Return to activities to reopen it.",
    STALE_STORY_CHAPTER: "This chapter has changed. Reload the story before answering.",
    ACTIVITY_NOT_REACHED: "Reach the final activity before saving your work.",
    SAVE_NO_ENTRY: "Add a reflection or photo before saving.",
    SAVE_TOO_MANY_IMAGES: "Choose up to three photos.",
    SAVE_IMAGE_TOO_LARGE: "This photo is too large. Try a smaller version.",
    SAVE_INVALID_IMAGE: "Choose a valid JPEG, PNG, or WebP photo.",
    SAVE_TEXT_TOO_LONG: "Keep your reflection within 5,000 characters.",
    REFLECTION_UNAVAILABLE: "Your saved work is unavailable. Please try again.",
    STORY_NOT_FOUND: "This story isn't available to your account. Return to activities and try again.",
  };
  return messages[code] ?? "We couldn't complete that request. Please try again.";
}

async function post<T>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError("NETWORK_ERROR", 0, "We couldn't connect. Check your connection, then try again.");
  }
  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new ApiError("INVALID_RESPONSE", response.status, "The server sent an unreadable response. Please try loading again.");
  }
  if (!response.ok) {
    const code = typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
      ? result.error : "SERVER_ERROR";
    throw new ApiError(code, response.status, messageFor(code, response.status));
  }
  if (typeof result !== "object" || result === null || Array.isArray(result)) {
    throw new ApiError("INVALID_RESPONSE", response.status, "The server sent an incomplete response. Please try loading again.");
  }
  return result as T;
}

export const api = {
  // Authentication

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
    return post<{ ended: string }>("/auth/sign-out");
  },

  // Profile

  getProfile() {
    return post<Profile>("/account/profile");
  },

  createProfile(name: string, about: string) {
    return post<{ profile: string }>(
      "/account/create",
      { name, about },
    );
  },

  updateProfile(name: string, about: string) {
    return post<{ profile: string }>(
      "/account/update",
      { name, about },
    );
  },

  // Interests

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

  // Stories

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

  getStories() {
    return post<{ stories: StorySummary[] }>(
      "/stories/list",
    );
  },

  continueStory(story: string, answer: string, expectedChapter?: string) {
    return post<{ chapter: string }>(
      "/stories/continue",
      { story, answer, expectedChapter },
    );
  },

  getReflection(story: string) {
    return post<WorkResponse>("/stories/reflection/get", { story });
  },

  saveReflection(story: string, text: string, images: string[]) {
    return post<WorkResponse>("/stories/reflection/save", { story, text, images });
  },

  // Explorations

  getExplorations() {
    return post<{ explorations: Exploration[] }>(
      "/explorations/history",
    );
  },
};

import { httpPolicy } from "@mit-sdg/sync-engine-http/policy";

export const policy = httpPolicy({
  // The browser will talk to the frontend, which forwards /api to this server.
  publicOrigin: process.env.PUBLIC_ORIGIN ?? "http://127.0.0.1:8080",
  basePath: "/api",
  limits: { requestBodyBytes: 5_242_880 },
  publicErrors: {
    INVALID_USERNAME: "INVALID_REQUEST",
    INVALID_EMAIL: "INVALID_REQUEST",
    WEAK_PASSWORD: "INVALID_REQUEST",
    USERNAME_TAKEN: "CONFLICT",
    EMAIL_TAKEN: "CONFLICT",
    INVALID_CREDENTIALS: "UNAUTHORIZED",
    INVALID_RECOVERY: "INVALID_REQUEST",
    UNKNOWN_SESSION: "UNAUTHORIZED",
    BLANK_NAME: "INVALID_REQUEST",
    PROFILE_EXISTS: "CONFLICT",
    NO_PROFILE: "NOT_FOUND",
    STORY_ALREADY_EXISTS: "CONFLICT",
    STORY_NOT_FOUND: "NOT_FOUND",
    GET_STORY_NOT_FOUND: "NOT_FOUND",
    ACTIVITY_STORY_NOT_FOUND: "NOT_FOUND",
    ACTIVITY_NOT_REACHED: "INVALID_REQUEST",
    INVALID_STORY_ANSWER: "INVALID_REQUEST",
    STALE_STORY_CHAPTER: "CONFLICT",
    STORY_CANNOT_CONTINUE: "INVALID_REQUEST",
    SAVE_INVALID_REFERENCE: "INVALID_REQUEST",
    SAVE_TEXT_TOO_LONG: "INVALID_REQUEST",
    SAVE_TOO_MANY_IMAGES: "INVALID_REQUEST",
    SAVE_IMAGE_TOO_LARGE: "INVALID_REQUEST",
    SAVE_INVALID_IMAGE: "INVALID_REQUEST",
    SAVE_NO_ENTRY: "INVALID_REQUEST",
    GET_INVALID_REFERENCE: "INVALID_REQUEST",
  },
  cookies: {
    session: {
      name: "ask-jordan-session",
      input: "session",
      issue: [
        { path: "/auth/register", value: "session", expires: "expiresAt" },
        { path: "/auth/sign-in", value: "session", expires: "expiresAt" },
      ],
      clear: ["/auth/sign-out"],
    },
  },
});

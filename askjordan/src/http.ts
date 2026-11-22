import { httpPolicy } from "@mit-sdg/sync-engine-http/policy";

export const policy = httpPolicy({
  // The browser will talk to the frontend, which forwards /api to this server.
  publicOrigin: process.env.PUBLIC_ORIGIN ?? "http://127.0.0.1:8080",
  basePath: "/api",
  publicErrors: {
    INVALID_USERNAME: "INVALID_REQUEST",
    WEAK_PASSWORD: "INVALID_REQUEST",
    USERNAME_TAKEN: "CONFLICT",
    INVALID_CREDENTIALS: "UNAUTHORIZED",
    UNKNOWN_SESSION: "UNAUTHORIZED",
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

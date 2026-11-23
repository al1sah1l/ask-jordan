
import type { Db } from "mongodb";

import {
  SessioningConcept,
  UnknownSession,
} from "../concepts/Sessioning.ts";

import {
  getPersistenceConcepts,
  type assembleApplication,
} from "../assembly.ts";

import {
  ProgressiveStoryNotFound,
} from "./ProgressiveStoryEngine.ts";

type Application = ReturnType<
  typeof assembleApplication
>;

const COOKIE_NAME = "ask-jordan-session";

function json(
  body: unknown,
  status = 200,
): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function sessionCookie(
  request: Request,
): string | null {
  const header = request.headers.get("cookie");

  if (!header) return null;

  for (const part of header.split(";")) {
    const [name, ...value] = part.trim().split("=");

    if (name === COOKIE_NAME) {
      const session = value.join("=");
      return session || null;
    }
  }

  return null;
}

function validStoryInput(
  value: unknown,
): value is { story: string } {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return false;
  }

  const story = (value as Record<string, unknown>).story;

  return (
    typeof story === "string" &&
    story.trim().length > 0 &&
    story.length <= 200
  );
}

export function createProgressiveHttpHandler(
  application: Application,
  database: Db,
) {
  const sessioning = new SessioningConcept(database);

  return async function handleProgressive(
    request: Request,
  ): Promise<Response> {
    if (
      new URL(request.url).pathname !==
      "/api/stories/progressive/get"
    ) {
      return json({ error: "NOT_FOUND" }, 404);
    }

    if (request.method !== "POST") {
      return json(
        { error: "METHOD_NOT_ALLOWED" },
        405,
      );
    }

    const expectedOrigin =
      process.env.PUBLIC_ORIGIN ??
      "http://127.0.0.1:8080";

    if (
      request.headers.get("origin") !==
      expectedOrigin
    ) {
      return json({ error: "FORBIDDEN" }, 403);
    }

    const session = sessionCookie(request);

    if (!session) {
      return json(
        { error: "UNAUTHORIZED" },
        401,
      );
    }

    let user: string;

    try {
      const result = await sessioning.current({
        session,
      });

      user = result.user;
    } catch (error) {
      if (error instanceof UnknownSession) {
        return json(
          { error: "UNAUTHORIZED" },
          401,
        );
      }

      return json(
        { error: "INTERNAL_ERROR" },
        500,
      );
    }

    if (
      !request.headers
        .get("content-type")
        ?.toLowerCase()
        .startsWith("application/json")
    ) {
      return json(
        { error: "INVALID_REQUEST" },
        400,
      );
    }

    let input: unknown;

    try {
      const body = await request.text();

      if (
        Buffer.byteLength(body) > 10_000
      ) {
        return json(
          { error: "INVALID_REQUEST" },
          400,
        );
      }

      input = JSON.parse(body);
    } catch {
      return json(
        { error: "INVALID_REQUEST" },
        400,
      );
    }

    if (!validStoryInput(input)) {
      return json(
        { error: "INVALID_REQUEST" },
        400,
      );
    }

    const { progressive } =
      getPersistenceConcepts(application);

    try {
      const story = progressive.getStory({
        user,
        story: input.story,
      });

      return json({
        story: story.story,
        activity: story.activity,
        format: "progressive",
        chapters: story.chapters,
      });
    } catch (error) {
      if (error instanceof ProgressiveStoryNotFound) {
        return json(
          { error: "NOT_FOUND" },
          404,
        );
      }

      return json(
        { error: "INTERNAL_ERROR" },
        500,
      );
    }
  };
}

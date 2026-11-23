
import type { Db } from "mongodb";

import {
  SessioningConcept,
  UnknownSession,
} from "../concepts/Sessioning.ts";

import {
  AccountConcept,
  NoProfile,
} from "../concepts/Account.ts";

import {
  CatalogEntryNotFound,
} from "../concepts/InterestCollection.ts";

import {
  StoryAlreadyExists,
} from "../concepts/StoryGeneration.ts";

import {
  getPersistenceConcepts,
  type assembleApplication,
} from "../assembly.ts";

import {
  ProgressiveStoryAlreadyExists,
  ProgressiveStoryNotFound,
} from "./ProgressiveStoryEngine.ts";

import {
  START_PROGRESSIVE_STORY,
} from "./progressive-symbols.ts";

import {
  ApplicationPersistence,
} from "../persistence.ts";

type Application = ReturnType<
  typeof assembleApplication
>;

const COOKIE_NAME = "ask-jordan-session";

const GET_PATH =
  "/api/stories/progressive/get";

const START_PATH =
  "/api/stories/progressive/start";

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

  if (!header) {
    return null;
  }

  for (const part of header.split(";")) {
    const [name, ...value] =
      part.trim().split("=");

    if (name === COOKIE_NAME) {
      const session = value.join("=");

      return session || null;
    }
  }

  return null;
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function validStoryInput(
  value: unknown,
): value is { story: string } {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.story === "string" &&
    value.story.trim().length > 0 &&
    value.story.length <= 200
  );
}

function validStartInput(
  value: unknown,
): value is { activity: string } {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.activity === "string" &&
    value.activity.trim().length > 0 &&
    value.activity.length <= 200
  );
}

export function createProgressiveHttpHandler(
  application: Application,
  database: Db,
  persistence = new ApplicationPersistence(database),
) {
  const sessioning =
    new SessioningConcept(database);

  const accounts =
    new AccountConcept(database);

  /*
   * Serialize progressive mutations and persistence.
   *
   * This prevents two progressive start requests
   * from being committed simultaneously within
   * the same handler instance.
   *
   * Other application routes are not part of this
   * queue yet; cross-route and multi-process
   * consistency will need additional work.
   */
  let pending: Promise<void> =
    Promise.resolve();

  function serialize<T>(
    operation: () => Promise<T>,
  ): Promise<T> {
    const result = pending.then(operation);

    pending = result.then(
      () => undefined,
      () => undefined,
    );

    return result;
  }

  async function getProgressiveStory(
    user: string,
    storyId: string,
  ): Promise<Response> {
    const { progressive } =
      getPersistenceConcepts(application);

    try {
      const story = progressive.getStory({
        user,
        story: storyId,
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

      console.error(
        "Progressive story read failed:",
        error,
      );

      return json(
        { error: "INTERNAL_ERROR" },
        500,
      );
    }
  }

  async function startProgressiveStory(
    user: string,
    activity: string,
  ): Promise<Response> {
    return serialize(async () => {
      try {
        /*
         * Personalization comes from the authenticated
         * user's saved profile, never from the client.
         */
        const profile = await accounts.getProfile({
          user,
        });

        const { stories } =
          getPersistenceConcepts(application);

        /*
         * StoryGeneration owns activity validation
         * and duplicate-story checks across formats.
         */
        const started =
          await stories[START_PROGRESSIVE_STORY]({
            user,
            activity,
            context: profile.about,
          });

        /*
         * A successful response is returned only
         * after the snapshot is saved to MongoDB.
         */
        try {
          await persistence.save(application);
        } catch (error) {
          console.error(
            "Failed to persist progressive story:",
            error,
          );

          return json(
            { error: "PERSISTENCE_FAILED" },
            503,
          );
        }

        return json({
          story: started.story,
          chapter: started.chapter,
          format: "progressive",
        });
      } catch (error) {
        if (error instanceof NoProfile) {
          return json(
            { error: "NOT_FOUND" },
            404,
          );
        }

        if (error instanceof CatalogEntryNotFound) {
          return json(
            { error: "INVALID_REQUEST" },
            400,
          );
        }

        if (
          error instanceof StoryAlreadyExists ||
          error instanceof ProgressiveStoryAlreadyExists
        ) {
          return json(
            { error: "CONFLICT" },
            409,
          );
        }

        console.error(
          "Progressive story creation failed:",
          error instanceof Error
            ? error.name
            : "UnknownError",
        );

        return json(
          { error: "GENERATION_FAILED" },
          503,
        );
      }
    });
  }

  return async function handleProgressive(
    request: Request,
  ): Promise<Response> {
    const path =
      new URL(request.url).pathname;

    const isGet = path === GET_PATH;
    const isStart = path === START_PATH;

    if (!isGet && !isStart) {
      return json(
        { error: "NOT_FOUND" },
        404,
      );
    }

    if (request.method !== "POST") {
      return json(
        { error: "METHOD_NOT_ALLOWED" },
        405,
      );
    }

    /*
     * Same-origin protection.
     */
    const expectedOrigin =
      process.env.PUBLIC_ORIGIN ??
      "http://127.0.0.1:8080";

    if (
      request.headers.get("origin") !==
      expectedOrigin
    ) {
      return json(
        { error: "FORBIDDEN" },
        403,
      );
    }

    /*
     * Authenticate the session cookie.
     */
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

      console.error(
        "Session validation failed:",
        error,
      );

      return json(
        { error: "INTERNAL_ERROR" },
        500,
      );
    }

    /*
     * Validate request content.
     */
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
      const contentLength = Number(
        request.headers.get("content-length"),
      );

      if (
        Number.isFinite(contentLength) &&
        contentLength > 10_000
      ) {
        return json(
          { error: "INVALID_REQUEST" },
          400,
        );
      }

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

    /*
     * Read an existing progressive story.
     */
    if (isGet) {
      if (!validStoryInput(input)) {
        return json(
          { error: "INVALID_REQUEST" },
          400,
        );
      }

      return getProgressiveStory(
        user,
        input.story,
      );
    }

    /*
     * Start a new progressive story.
     */
    if (isStart) {
      if (!validStartInput(input)) {
        return json(
          { error: "INVALID_REQUEST" },
          400,
        );
      }

      return startProgressiveStory(
        user,
        input.activity,
      );
    }

    return json(
      { error: "NOT_FOUND" },
      404,
    );
  };
}

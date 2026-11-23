
import {
  createGateway,
} from "@mit-sdg/sync-engine/boundary";

import {
  createHttpHandler,
} from "@mit-sdg/sync-engine-http/handler";

import {
  assembleApplication,
} from "./assembly.ts";

import {
  seedCatalog,
} from "./catalog.ts";

import {
  db,
} from "./db.ts";

import {
  policy,
} from "./http.ts";

import {
  ApplicationPersistence,
} from "./persistence.ts";

import {
  createProgressiveHttpHandler,
} from "./learning/progressiveHttp.ts";

/*
 * Assemble the application and restore state.
 */
const application = assembleApplication();

const persistence =
  new ApplicationPersistence(db);

// Restore existing catalog IDs, preferences,
// stories, chapters, and exploration progress.
const restored =
  await persistence.restore(application);

// Seed missing predefined activities without
// replacing IDs used by saved stories.
await seedCatalog(application);

// Persist the initial catalog as well.
await persistence.save(application);

console.log(
  restored
    ? "Restored Ask Jordan application state from MongoDB."
    : "Initialized new Ask Jordan application state.",
);

/*
 * Existing sync-engine HTTP API.
 */
const httpApi = createHttpHandler({
  application,
  gateway: createGateway({ application }),
  policy,
});

/*
 * Progressive Story HTTP API.
 *
 * Shares the same application and persistence.
 */
const progressiveHttp =
  createProgressiveHttpHandler(
    application,
    db,
    persistence,
  );

/*
 * Existing routes that mutate application state.
 *
 * Progressive start is intentionally excluded:
 * the progressive handler persists it directly.
 */
const persistentPaths = new Set([
  "/api/interests/preference",
  "/api/stories/start",
  "/api/stories/continue",
  "/api/explorations/complete",
]);

const progressivePaths = new Set([
  "/api/stories/progressive/get",
  "/api/stories/progressive/start",
]);

/*
 * Central API handler.
 */
async function api(
  request: Request,
): Promise<Response> {
  const path =
    new URL(request.url).pathname;

  /*
   * Progressive endpoints.
   */
  if (progressivePaths.has(path)) {
    return progressiveHttp(request);
  }

  /*
   * Existing endpoints.
   */
  const response = await httpApi(request);

  /*
   * Read-only or unsuccessful requests
   * should not trigger application snapshots.
   */
  if (
    request.method !== "POST" ||
    !persistentPaths.has(path) ||
    !response.ok
  ) {
    return response;
  }

  /*
   * Persist successful legacy mutations.
   */
  try {
    await persistence.save(application);

    return response;
  } catch (error) {
    console.error(
      "Failed to save application state:",
      error,
    );

    return Response.json(
      { error: "PERSISTENCE_FAILED" },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}

/*
 * Bun HTTP server.
 */
const server = Bun.serve({
  hostname:
    process.env.HOST ??
    "127.0.0.1",

  port: Number(
    process.env.PORT ??
    3000,
  ),

  routes: {
    "/api/*": api,

    "/health": async () => {
      try {
        await db.command(
          { ping: 1 },
          { timeoutMS: 3000 },
        );

        return Response.json(
          { status: "ok" },
          {
            headers: {
              "Cache-Control": "no-store",
            },
          },
        );
      } catch {
        return Response.json(
          { status: "unavailable" },
          {
            status: 503,
            headers: {
              "Cache-Control": "no-store",
            },
          },
        );
      }
    },
  },
});

console.log(
  `Backend listening on ${server.url}`,
);

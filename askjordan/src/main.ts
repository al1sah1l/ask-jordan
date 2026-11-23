
import { createGateway } from "@mit-sdg/sync-engine/boundary";
import { createHttpHandler } from "@mit-sdg/sync-engine-http/handler";
import { assembleApplication } from "./assembly.ts";
import { seedCatalog } from "./catalog.ts";
import { db } from "./db.ts";
import { policy } from "./http.ts";
import { ApplicationPersistence } from "./persistence.ts";
import { createProgressiveHttpHandler } from "./learning/progressiveHttp.ts";

const application = assembleApplication();
const persistence = new ApplicationPersistence(db);

const restored = await persistence.restore(application);
await seedCatalog(application);
await persistence.save(application);

console.log(
  restored
    ? "Restored Ask Jordan application state from MongoDB."
    : "Initialized new Ask Jordan application state.",
);

const httpApi = createHttpHandler({
  application,
  gateway: createGateway({ application }),
  policy,
});

const progressiveHttp = createProgressiveHttpHandler(application, db, persistence);

const persistentPaths = new Set([
  "/api/interests/preference",
  "/api/stories/start",
  "/api/stories/continue",
  "/api/explorations/complete",
]);

const progressivePaths = new Set([
  "/api/stories/progressive/get",
  "/api/stories/progressive/start",
  "/api/stories/progressive/choice",
  "/api/stories/progressive/reflection/get",
  "/api/stories/progressive/reflection/save",
  "/api/stories/progressive/next",
]);

async function api(request: Request): Promise<Response> {
  const path = new URL(request.url).pathname;

  // Progressive HTTP handler persists its own mutations.
  if (progressivePaths.has(path)) return progressiveHttp(request);

  // Existing sync-engine API.
  const response = await httpApi(request);

  if (request.method !== "POST" || !persistentPaths.has(path) || !response.ok) {
    return response;
  }

  try {
    await persistence.save(application);
    return response;
  } catch (error) {
    console.error("Failed to save application state:", error);
    return Response.json(
      { error: "PERSISTENCE_FAILED" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

const server = Bun.serve({
  hostname: process.env.HOST ?? "127.0.0.1",
  port: Number(process.env.PORT ?? 3000),

  routes: {
    "/api/*": api,

    "/health": async () => {
      try {
        await db.command({ ping: 1 }, { timeoutMS: 3000 });
        return Response.json(
          { status: "ok" },
          { headers: { "Cache-Control": "no-store" } },
        );
      } catch {
        return Response.json(
          { status: "unavailable" },
          { status: 503, headers: { "Cache-Control": "no-store" } },
        );
      }
    },
  },
});

console.log(`Backend listening on ${server.url}`);

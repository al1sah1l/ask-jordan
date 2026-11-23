
import type { Db } from "mongodb";
import { SessioningConcept, UnknownSession } from "../concepts/Sessioning.ts";
import { AccountConcept, NoProfile } from "../concepts/Account.ts";
import { CatalogEntryNotFound } from "../concepts/InterestCollection.ts";
import { StoryAlreadyExists } from "../concepts/StoryGeneration.ts";
import {
  ReflectingConcept, ReflectionUnavailable, SaveInvalidReference, SaveTextTooLong,
  SaveTooManyImages, SaveImageTooLarge, SaveInvalidImage, SaveNoEntry,
} from "../concepts/Reflecting.ts";
import { getPersistenceConcepts, type assembleApplication } from "../assembly.ts";
import {
  ProgressiveStoryAlreadyExists, ProgressiveStoryNotFound, StaleProgressiveChapter,
} from "./ProgressiveStoryEngine.ts";
import { ChapterNotReady, InvalidChapterChoice, InvalidChapterTransition } from "./ProgressiveChapter.ts";
import { START_PROGRESSIVE_STORY } from "./progressive-symbols.ts";
import { ApplicationPersistence } from "../persistence.ts";

type Application = ReturnType<typeof assembleApplication>;
type ChoiceStage = "first-choice" | "second-choice";
type ChoiceInput = { story: string; chapter: string; answer: string; expectedStage: ChoiceStage };
type ChapterInput = { story: string; chapter: string };
type ReflectionInput = ChapterInput & { text: string; images: string[] };

const BASE = "/api/stories/progressive";
const GET_PATH = `${BASE}/get`;
const START_PATH = `${BASE}/start`;
const CHOICE_PATH = `${BASE}/choice`;
const REFLECTION_GET_PATH = `${BASE}/reflection/get`;
const REFLECTION_SAVE_PATH = `${BASE}/reflection/save`;
const NEXT_PATH = `${BASE}/next`;
const COOKIE_NAME = "ask-jordan-session";
const MAX_BODY_BYTES = 5_242_880;

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function sessionCookie(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;

  for (const part of header.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === COOKIE_NAME) return value.join("=") || null;
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 200;
}

function validStoryInput(value: unknown): value is { story: string } {
  return isRecord(value) && validId(value.story);
}

function validStartInput(value: unknown): value is { activity: string } {
  return isRecord(value) && validId(value.activity);
}

function validChapterInput(value: unknown): value is ChapterInput & Record<string, unknown> {
  return isRecord(value) && validId(value.story) && validId(value.chapter);
}

function validChoiceInput(value: unknown): value is ChoiceInput {
  return (
    validChapterInput(value) &&
    typeof value.answer === "string" &&
    value.answer.trim().length > 0 &&
    value.answer.length <= 2000 &&
    (value.expectedStage === "first-choice" || value.expectedStage === "second-choice")
  );
}

function validReflectionInput(value: unknown): value is ReflectionInput {
  return (
    validChapterInput(value) &&
    typeof value.text === "string" &&
    value.text.length <= 5000 &&
    Array.isArray(value.images) &&
    value.images.length <= 3 &&
    value.images.every((image: unknown) => typeof image === "string") &&
    (value.text.trim().length > 0 || value.images.length > 0)
  );
}

export function createProgressiveHttpHandler(
  application: Application,
  database: Db,
  persistence = new ApplicationPersistence(database),
) {
  const sessioning = new SessioningConcept(database);
  const accounts = new AccountConcept(database);
  const reflecting = new ReflectingConcept(database);

  // Progressive writes are serialized within this handler instance.
  let pending: Promise<void> = Promise.resolve();

  function serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = pending.then(operation);
    pending = result.then(() => undefined, () => undefined);
    return result;
  }

  async function saveState(): Promise<boolean> {
    try {
      await persistence.save(application);
      return true;
    } catch (error) {
      console.error("Failed to persist progressive state:", error);
      return false;
    }
  }

  function latestChapter(user: string, storyId: string) {
    const { progressive } = getPersistenceConcepts(application);
    const story = progressive.getStory({ user, story: storyId });
    return story.chapters.at(-1);
  }

  async function getProgressiveStory(user: string, storyId: string): Promise<Response> {
    try {
      const { progressive } = getPersistenceConcepts(application);
      const story = progressive.getStory({ user, story: storyId });

      return json({
        story: story.story,
        activity: story.activity,
        format: "progressive",
        chapters: story.chapters,
      });
    } catch (error) {
      if (error instanceof ProgressiveStoryNotFound) return json({ error: "NOT_FOUND" }, 404);
      console.error("Progressive story read failed:", error);
      return json({ error: "INTERNAL_ERROR" }, 500);
    }
  }

  async function startProgressiveStory(user: string, activity: string): Promise<Response> {
    return serialize(async () => {
      try {
        const profile = await accounts.getProfile({ user });
        const { stories } = getPersistenceConcepts(application);
        const started = await stories[START_PROGRESSIVE_STORY]({
          user, activity, context: profile.about,
        });

        if (!(await saveState())) return json({ error: "PERSISTENCE_FAILED" }, 503);
        return json({ story: started.story, chapter: started.chapter, format: "progressive" });
      } catch (error) {
        if (error instanceof NoProfile) return json({ error: "NOT_FOUND" }, 404);
        if (error instanceof CatalogEntryNotFound) return json({ error: "INVALID_REQUEST" }, 400);

        if (error instanceof StoryAlreadyExists || error instanceof ProgressiveStoryAlreadyExists) {
          return json({ error: "CONFLICT" }, 409);
        }

        console.error("Progressive story creation failed:", error instanceof Error ? error.name : "UnknownError");
        return json({ error: "GENERATION_FAILED" }, 503);
      }
    });
  }

  async function submitProgressiveChoice(user: string, input: ChoiceInput): Promise<Response> {
    return serialize(async () => {
      const { progressive } = getPersistenceConcepts(application);

      try {
        const current = latestChapter(user, input.story);

        if (!current || current.chapter !== input.chapter || current.stage !== input.expectedStage) {
          return json({ error: "CONFLICT" }, 409);
        }

        const question = input.expectedStage === "first-choice" ? current.firstQuestion : current.secondQuestion;
        if (!question) return json({ error: "CONFLICT" }, 409);

        const answer = input.answer.trim();
        if (question.options && !question.options.includes(answer)) {
          return json({ error: "INVALID_REQUEST" }, 400);
        }

        const result = await progressive.submitChoice({
          user, story: input.story, chapter: input.chapter, answer,
          expectedStage: input.expectedStage,
        });

        if (!(await saveState())) return json({ error: "PERSISTENCE_FAILED" }, 503);
        return json({ story: input.story, chapter: result.chapter, stage: result.stage });
      } catch (error) {
        if (error instanceof ProgressiveStoryNotFound) return json({ error: "NOT_FOUND" }, 404);
        if (error instanceof StaleProgressiveChapter) return json({ error: "CONFLICT" }, 409);
        if (error instanceof InvalidChapterChoice) return json({ error: "INVALID_REQUEST" }, 400);

        console.error("Progressive choice failed:", error instanceof Error ? error.name : "UnknownError");
        return json({ error: "GENERATION_FAILED" }, 503);
      }
    });
  }

  async function getReflection(user: string, input: ChapterInput): Promise<Response> {
    try {
      const current = latestChapter(user, input.story);
      if (!current || current.chapter !== input.chapter) return json({ error: "CONFLICT" }, 409);
      if (current.stage !== "awaiting-reflection" && current.stage !== "reflected") {
        return json({ error: "CONFLICT" }, 409);
      }

      const { entry } = await reflecting.get({ user, story: input.story, chapter: input.chapter });
      return json({ entry });
    } catch (error) {
      if (error instanceof ProgressiveStoryNotFound) return json({ error: "NOT_FOUND" }, 404);
      console.error("Progressive reflection read failed:", error);
      return json({ error: "INTERNAL_ERROR" }, 500);
    }
  }

  async function saveReflection(user: string, input: ReflectionInput): Promise<Response> {
    return serialize(async () => {
      try {
        const current = latestChapter(user, input.story);
        if (!current || current.chapter !== input.chapter || current.stage !== "awaiting-reflection") {
          return json({ error: "CONFLICT" }, 409);
        }

        // Reflecting validates and saves the actual text/photos in MongoDB.
        const saved = await reflecting.save({
          user, story: input.story, chapter: input.chapter, text: input.text, images: input.images,
        });

        // The engine independently verifies that the stored page exists.
        const { progressive } = getPersistenceConcepts(application);
        await progressive.confirmSavedReflection({
          user, story: input.story, chapter: input.chapter,
        });

        if (!(await saveState())) return json({ error: "PERSISTENCE_FAILED" }, 503);

        return json({
          story: input.story,
          chapter: input.chapter,
          page: saved.page,
          stage: "reflected",
        });
      } catch (error) {
        if (error instanceof ProgressiveStoryNotFound) return json({ error: "NOT_FOUND" }, 404);
        if (error instanceof StaleProgressiveChapter) return json({ error: "CONFLICT" }, 409);
        if (error instanceof ChapterNotReady || error instanceof InvalidChapterTransition) {
          return json({ error: "CONFLICT" }, 409);
        }

        if (
          error instanceof SaveInvalidReference || error instanceof SaveTextTooLong ||
          error instanceof SaveTooManyImages || error instanceof SaveImageTooLarge ||
          error instanceof SaveInvalidImage || error instanceof SaveNoEntry
        ) {
          return json({ error: "INVALID_REQUEST" }, 400);
        }

        if (error instanceof ReflectionUnavailable) return json({ error: "INTERNAL_ERROR" }, 500);
        console.error("Progressive reflection save failed:", error);
        return json({ error: "INTERNAL_ERROR" }, 500);
      }
    });
  }

  async function nextChapter(user: string, input: ChapterInput): Promise<Response> {
    return serialize(async () => {
      try {
        const current = latestChapter(user, input.story);
        if (!current || current.chapter !== input.chapter || current.stage !== "reflected") {
          return json({ error: "CONFLICT" }, 409);
        }

        const { progressive } = getPersistenceConcepts(application);
        const next = await progressive.nextChapter({ user, story: input.story });

        if (!(await saveState())) return json({ error: "PERSISTENCE_FAILED" }, 503);
        return json({ story: input.story, chapter: next.chapter, position: current.position + 1 });
      } catch (error) {
        if (error instanceof ProgressiveStoryNotFound) return json({ error: "NOT_FOUND" }, 404);
        if (error instanceof ChapterNotReady || error instanceof StaleProgressiveChapter) {
          return json({ error: "CONFLICT" }, 409);
        }

        console.error("Progressive next chapter failed:", error instanceof Error ? error.name : "UnknownError");
        return json({ error: "GENERATION_FAILED" }, 503);
      }
    });
  }

  return async function handleProgressive(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    const paths = [GET_PATH, START_PATH, CHOICE_PATH, REFLECTION_GET_PATH, REFLECTION_SAVE_PATH, NEXT_PATH];

    if (!paths.includes(path)) return json({ error: "NOT_FOUND" }, 404);
    if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

    const expectedOrigin = process.env.PUBLIC_ORIGIN ?? "http://127.0.0.1:8080";
    if (request.headers.get("origin") !== expectedOrigin) return json({ error: "FORBIDDEN" }, 403);

    const session = sessionCookie(request);
    if (!session) return json({ error: "UNAUTHORIZED" }, 401);

    let user: string;
    try {
      user = (await sessioning.current({ session })).user;
    } catch (error) {
      if (error instanceof UnknownSession) return json({ error: "UNAUTHORIZED" }, 401);
      console.error("Session validation failed:", error);
      return json({ error: "INTERNAL_ERROR" }, 500);
    }

    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return json({ error: "INVALID_REQUEST" }, 400);
    }

    let input: unknown;

    try {
      const maxBytes = path === REFLECTION_SAVE_PATH ? MAX_BODY_BYTES : 10_000;
      const contentLength = Number(request.headers.get("content-length"));

      if (Number.isFinite(contentLength) && contentLength > maxBytes) {
        return json({ error: "INVALID_REQUEST" }, 400);
      }

      const body = await request.text();
      if (Buffer.byteLength(body) > maxBytes) return json({ error: "INVALID_REQUEST" }, 400);
      input = JSON.parse(body);
    } catch {
      return json({ error: "INVALID_REQUEST" }, 400);
    }

    if (path === GET_PATH) {
      if (!validStoryInput(input)) return json({ error: "INVALID_REQUEST" }, 400);
      return getProgressiveStory(user, input.story);
    }

    if (path === START_PATH) {
      if (!validStartInput(input)) return json({ error: "INVALID_REQUEST" }, 400);
      return startProgressiveStory(user, input.activity);
    }

    if (path === CHOICE_PATH) {
      if (!validChoiceInput(input)) return json({ error: "INVALID_REQUEST" }, 400);
      return submitProgressiveChoice(user, input);
    }

    if (path === REFLECTION_GET_PATH) {
      if (!validChapterInput(input)) return json({ error: "INVALID_REQUEST" }, 400);
      return getReflection(user, input);
    }

    if (path === REFLECTION_SAVE_PATH) {
      if (!validReflectionInput(input)) return json({ error: "INVALID_REQUEST" }, 400);
      return saveReflection(user, input);
    }

    if (path === NEXT_PATH) {
      if (!validChapterInput(input)) return json({ error: "INVALID_REQUEST" }, 400);
      return nextChapter(user, input);
    }

    return json({ error: "NOT_FOUND" }, 404);
  };
}

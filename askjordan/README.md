# Ask Jordan Alpha

Ask Jordan lets a student create an account, save a profile, browse eight activities, and read an interactive adventure guided by Jordan. New stories use progressive learning chapters with two decisions, a conclusion, a practical challenge, and a reflection before the next chapter. Existing three-chapter stories remain supported.

## Run locally

Use Bun 1.3.4 or newer and Podman with Compose. Install the package dependencies with `bun install`, copy `.env.example` to `.env`, and set `MONGODB_URL` to your MongoDB connection. `bun run dev` starts MongoDB and the backend/frontend development processes. Open http://127.0.0.1:8080. You can also start MongoDB with `bun run db:up`, then run `bun run dev:backend` and `bun run dev:frontend` in separate terminals. Match `PUBLIC_ORIGIN` to the browser origin if deploying elsewhere.

The development frontend redirects `localhost:8080` to `127.0.0.1:8080` so browser requests match `PUBLIC_ORIGIN`. Its loopback-only HTTP proxy uses a local session cookie with `HttpOnly` and `SameSite=Strict`, translating it to the backend's secure cookie name. This permits local testing in browsers that reject secure cookies over HTTP. The production backend continues to issue `Secure`, `__Host-` session cookies and should be served over HTTPS. Register a new account with a 3–32-character username (letters, numbers, underscores, or hyphens) and an 8–128-character password; no default app account is seeded.

Profile includes an account-deletion control at the bottom. The authenticated `POST /api/account/delete` route requires the current password and an exact username confirmation. It removes the user's profile, interests, both story formats, explorations, reflections/photos, avatar records, cached suggestions, credentials, and all sessions. The host drains in-flight API requests and temporarily blocks new requests during deletion, preventing an older generation or save from restoring deleted state. Other users and the shared catalog remain intact. Cleanup is retryable after a storage failure; success is returned only after every cleanup step succeeds. MongoDB in local Compose is standalone, so cleanup across collections is not transactional.

Both live story prompts request 100–150 words per narrative passage, short paragraphs, and separate dialogue turns. Learning overviews use one or two short sentences. Existing saved stories keep their content while the reader formats dense passages into shorter paragraphs. Motion uses shared easing and respects reduced-motion preferences. Chapter progress is displayed in the reader, with a small progress line only for started adventures in Your Interests.

## Story generation

`STORY_GENERATION_MODE=auto` uses OpenAI when `OPENAI_API_KEY` is configured and prepared stories otherwise. `live` explicitly attempts OpenAI. `prepared` forces prepared stories without an OpenAI request, even when a key is present. `OPENAI_STORY_MODEL` defaults to `gpt-4.1-mini`. Keep keys on the backend only.

`PROGRESSIVE_GENERATION_MODE` accepts `auto` (the default), `prepared`, `live`, or `disabled`. Auto uses prepared learning chapters without a key and attempts OpenAI with a key. Live requires a key. Auto and live fall back to prepared content independently for the introduction, each decision's consequence, and subsequent chapters when a call fails, times out, or returns unusable content. Prepared mode makes no model calls; disabled refuses generation. When the progressive mode is unset, `STORY_GENERATION_MODE=prepared` also selects prepared learning chapters. Prepared learning chapters reuse the activity's adventure and add a planning, testing, and reflection overview.

Every OpenAI error, timeout, or unusable chapter falls back to the same production prepared generator. Prepared stories cover all eight catalog activities and include a generic unknown-activity adventure. Answers select consequences in later scenes. Prepared why questions take text answers. Live generation may supply two to four answers for an applicable closed decision; invalid choices fall back to a coherent prepared scene. Recognized unanswered legacy prepared prompts upgrade to the current why questions on restoration, while answered historical chapters retain their original questions and accepted answers. OpenAI generation validates chapter structure and retries malformed content once. Profile context and answers are treated as bounded data rather than instructions; live generation remains probabilistic.

## Profile and story journey

Create an account, enter a display name and an optional description, then choose an activity. Use Profile in the header to edit your saved details or cancel without saving. Activities marked Interested appear as clickable rows under Your Interests; click the interest button again to remove one. The Ask Jordan header returns to activities. Interests, activities you have tried, and available resources can make useful profile context. New stories capture the latest saved description. Existing stories retain their original description snapshot, including after profile updates and server restoration.

The saved name and description remain visible in a sticky panel while reading. Refresh reopens the current story from its URL after verifying it against the signed-in user's saved stories. Accepted answers, narrative passages, endings, and challenges reload from MongoDB; previous progressive chapters expose their full content in history. Returning to Activities or signing out clears the story URL. Unsubmitted drafts are not persisted.

Continue with two answers, read the ending, and try the mini challenge when ready. Save a reflection, photos, or both beneath the final activity. Private work reopens from MongoDB and can be replaced or edited without changing its page identity. Upload up to three JPEG, PNG, or WebP photos and up to 5,000 trimmed text characters. Saved photos are limited to 1 MiB each; the browser fits larger phone photos to that limit without cropping. The Save button briefly reads Saved after success. The server fully decodes images, rejects corrupt or mismatched content, limits images to 16 million pixels, rejects animated/multiframe PNG and WebP images, and bounds each JSON request to 5 MiB. Removing photos and saving replaces the saved image list. Saving work does not complete the exploration. Return to activities to reopen the same story. Account ownership comes from the session cookie. Profiles, story chapters, answers, preferences, and exploration state are persisted in MongoDB. When a story read fails, retry loading. After an uncertain answer submission, the reader checks saved state before permitting another answer.

## Validation

With MongoDB running and `MONGODB_URL` set, run `bun test` and `bun run check`. The tests use isolated temporary MongoDB databases. `bun run check` validates source agreement, generated artifacts, and TypeScript.

Run `bun run check:design` to validate all authored contracts. Reflection pages are stored separately from the application snapshot, so uploaded photos do not share one snapshot document limit. Database failures produce an unavailable error, never an empty or unsaved result. Both reflection routes resolve the cookie session and verify the owned story has reached its final activity before accessing work.

A frontend production build can be checked through the installed Vite API:

```sh
bun -e 'import { build } from "vite"; import vue from "@vitejs/plugin-vue"; await build({ root: "web", plugins: [vue()], build: { write: false } });'
```

`bun run generate` is the project command for generated contracts when approved design or composition changes require it. Do not edit generated artifacts by hand.

## Alpha boundaries

A student has at most one story per activity across both formats. Original stories have three chapters; progressive stories allow another chapter after a saved reflection. Reaching an original story's third chapter ends that story; it does not complete the exploration. Exploration completion remains a separate step. Story generation and exploration creation are coordinated actions rather than a database transaction. An uncertain network response is reconciled by reading saved state; story continuation accepts an optional `expectedChapter` guard (omission defaults to null for legacy callers). Stale or repeated guarded answers refuse; fetch the story after an uncertain response. Reflection replacement retries use the authorized user/story/final-chapter tuple and preserve page identity. Reopen saved work after an uncertain reply; accepted replacements use last-writer-wins semantics. Live OpenAI calls need working network access and a valid server key.

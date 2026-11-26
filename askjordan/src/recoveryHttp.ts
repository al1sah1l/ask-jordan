import type { Db } from "mongodb";
import { AuthenticatingConcept, InvalidEmail, InvalidRecovery, WeakPassword } from "./concepts/Authenticating.ts";
import { SessioningConcept } from "./concepts/Sessioning.ts";
import { sendPasswordRecovery } from "./mail.ts";

const ORIGIN = () => (process.env.PUBLIC_ORIGIN ?? "http://127.0.0.1:8080").replace(/\/$/, "");

function json(body: object, status = 200, cookie?: string): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...(cookie ? { "Set-Cookie": cookie } : {}),
    },
  });
}

function sessionCookie(session: string, expiresAt: Date): string {
  return `__Host-ask-jordan-session=${encodeURIComponent(session)}` +
    `; HttpOnly; SameSite=Strict; Path=/; Secure; Expires=${expiresAt.toUTCString()}`;
}

async function smallJson(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") {
    throw new Error("Invalid body");
  }
  if (!request.body) throw new Error("Missing body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = request.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) {
        await reader.cancel();
        throw new Error("Body too large");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function createRecoveryHandler(
  database: Db,
  mail: (email: string, link: string) => Promise<void> = sendPasswordRecovery,
) {
  const authenticating = new AuthenticatingConcept(database);
  const sessions = new SessioningConcept(database);

  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
    if (request.headers.get("origin") !== ORIGIN()) return json({ error: "FORBIDDEN" }, 403);

    const path = new URL(request.url).pathname;
    let input: unknown;
    try { input = await smallJson(request); }
    catch { return json({ error: "INVALID_REQUEST" }, 400); }
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return json({ error: "INVALID_REQUEST" }, 400);
    }

    if (path === "/api/auth/recover") return requestRecovery(input, authenticating, mail);
    if (path === "/api/auth/reset") return resetPassword(input, authenticating, sessions);
    return json({ error: "NOT_FOUND" }, 404);
  };
}

async function requestRecovery(
  input: object,
  authenticating: AuthenticatingConcept,
  mail: (email: string, link: string) => Promise<void>,
): Promise<Response> {
  if (!("email" in input) || typeof input.email !== "string") {
    return json({ error: "INVALID_REQUEST" }, 400);
  }
  try {
    const { token } = await authenticating.requestRecovery({ email: input.email });
    if (token) {
      const link = `${ORIGIN()}/?reset=${encodeURIComponent(token)}`;
      try {
        await mail(input.email.trim().toLowerCase(), link);
      } catch {
        console.error("Password recovery email was not sent.");
      }
    }
    return json({ accepted: true });
  } catch (error) {
    if (error instanceof InvalidEmail) return json({ error: "INVALID_EMAIL" }, 400);
    console.error("Password recovery could not be started.");
    return json({ error: "RECOVERY_UNAVAILABLE" }, 503);
  }
}

async function resetPassword(
  input: object,
  authenticating: AuthenticatingConcept,
  sessions: SessioningConcept,
): Promise<Response> {
  if (!("token" in input) || typeof input.token !== "string" ||
      !("password" in input) || typeof input.password !== "string") {
    return json({ error: "INVALID_REQUEST" }, 400);
  }
  try {
    const { account } = await authenticating.resetPassword({ token: input.token, password: input.password });
    const { session, expiresAt } = await sessions.start({ user: account });
    return json({ account }, 200, sessionCookie(session, expiresAt));
  } catch (error) {
    if (error instanceof InvalidRecovery) return json({ error: "INVALID_RECOVERY" }, 400);
    if (error instanceof WeakPassword) return json({ error: "WEAK_PASSWORD" }, 400);
    console.error("Password reset could not be finished.");
    return json({ error: "RECOVERY_UNAVAILABLE" }, 503);
  }
}

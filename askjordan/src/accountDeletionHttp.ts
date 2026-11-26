import type { Db } from "mongodb";
import type { assembleApplication } from "./assembly.ts";
import { AuthenticatingConcept, InvalidCredentials } from "./concepts/Authenticating.ts";
import { SessioningConcept, UnknownSession } from "./concepts/Sessioning.ts";
import { ApplicationPersistence } from "./persistence.ts";

const COOKIE = "__Host-ask-jordan-session";
const CLEARED_COOKIE = `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Secure; Max-Age=0`;

function json(body: object, status = 200, clearCookie = false): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...(clearCookie ? { "Set-Cookie": CLEARED_COOKIE } : {}) },
  });
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

export function createAccountDeletionHandler(
  application: ReturnType<typeof assembleApplication>,
  database: Db,
  persistence = new ApplicationPersistence(database),
) {
  const sessions = new SessioningConcept(database);
  const authenticating = new AuthenticatingConcept(database);

  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
    if (request.headers.get("origin") !== (process.env.PUBLIC_ORIGIN ?? "http://127.0.0.1:8080")) {
      return json({ error: "FORBIDDEN" }, 403);
    }

    try {
      const cookies = (request.headers.get("cookie") ?? "").split(";")
        .map(value => value.trim()).filter(value => value.startsWith(`${COOKIE}=`));
      if (cookies.length !== 1) return json({ error: "UNAUTHORIZED" }, 401, true);
      const session = cookies[0]!.slice(COOKIE.length + 1);
      const { user } = await sessions.current({ session });

      let input: unknown;
      try { input = await smallJson(request); }
      catch { return json({ error: "INVALID_REQUEST" }, 400); }
      if (!input || typeof input !== "object" || Array.isArray(input) ||
          !("confirmation" in input) || input.confirmation !== user) {
        return json({ error: "DELETE_CONFIRMATION_REQUIRED" }, 400);
      }
      if (!("password" in input) || typeof input.password !== "string" ||
          !input.password.length || input.password.length > 128) {
        return json({ error: "DELETE_PASSWORD_REQUIRED" }, 400);
      }

      try { await authenticating.authenticate({ username: user, password: input.password }); }
      catch (error) {
        if (error instanceof InvalidCredentials) return json({ error: "DELETE_PASSWORD_INCORRECT" }, 400);
        throw error;
      }

      // Credentials remain available for a retry until every data cleanup succeeds.
      await persistence.removeUser(application, user);
      for (const collection of [
        "reflecting.pages", "reflecting.journals", "avatarcustomizing.holdings", "avatarcustomizing.worn",
      ]) {
        await database.collection(collection).deleteMany({ user });
      }
      await database.collection<{ _id: string }>("account.profiles").deleteOne({ _id: user });
      await database.collection("sessioning.sessions").deleteMany({ user });
      await database.collection("authenticating.recoveries").deleteMany({ account: user });
      await database.collection<{ _id: string }>("authenticating.accounts").deleteOne({ _id: user });
      return json({ deleted: true }, 200, true);
    } catch (error) {
      if (error instanceof UnknownSession) return json({ error: "UNAUTHORIZED" }, 401, true);
      return json({ error: "ACCOUNT_DELETION_UNAVAILABLE" }, 503);
    }
  };
}

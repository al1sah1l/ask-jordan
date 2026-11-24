import { afterEach, expect, test } from "bun:test";
import { api, ApiError } from "../web/src/api/client.ts";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test("a proxy outage produces a useful temporary-unavailability error", async () => {
  globalThis.fetch = (async () => new Response("Bad Gateway", { status: 502 })) as unknown as typeof fetch;
  try {
    await api.currentUser();
    throw new Error("Expected unavailable response");
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: "SERVER_UNAVAILABLE", status: 502 });
    expect((error as Error).message).toContain("temporarily unavailable");
    expect((error as Error).message).not.toContain("unreadable");
  }
});

test("an invalid successful response remains an explicit retryable read error", async () => {
  globalThis.fetch = (async () => new Response("<html>unexpected page</html>", { status: 200 })) as unknown as typeof fetch;
  await expect(api.currentUser()).rejects.toMatchObject({ code: "INVALID_RESPONSE", status: 200 });
});

import { expect, test } from "bun:test";
import { ApplicationRequestGate } from "../src/applicationRequestGate.ts";

test("deletion waits for in-flight generation and blocks later requests until cleanup finishes", async () => {
  const gate = new ApplicationRequestGate();
  const events: string[] = [];
  const generation = Promise.withResolvers<void>();
  const deletion = Promise.withResolvers<void>();
  const deleteStarted = Promise.withResolvers<void>();
  const first = gate.run(async () => { events.push("generation"); await generation.promise; events.push("saved"); });
  const remove = gate.run(async () => { events.push("delete"); deleteStarted.resolve(); await deletion.promise; events.push("deleted"); }, true);
  const later = gate.run(async () => { events.push("next request"); });
  await Promise.resolve();
  expect(events).toEqual(["generation"]);
  generation.resolve();
  await deleteStarted.promise;
  expect(events).toEqual(["generation", "saved", "delete"]);
  deletion.resolve();
  await Promise.all([first, remove, later]);
  expect(events).toEqual(["generation", "saved", "delete", "deleted", "next request"]);
});

test("a failed deletion releases waiting requests", async () => {
  const gate = new ApplicationRequestGate();
  const failure = gate.run(async () => { throw new Error("storage unavailable"); }, true);
  const later = gate.run(async () => "available");
  await expect(failure).rejects.toThrow("storage unavailable");
  expect(await later).toBe("available");
});

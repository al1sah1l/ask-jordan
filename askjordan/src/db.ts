import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MongoClient } from "mongodb";

/** Bun loads `.env` from the shell directory. Tests also run from the repo root. */
function mongodbUrl(): string {
  if (process.env.MONGODB_URL) return process.env.MONGODB_URL;
  try {
    const envFile = readFileSync(join(import.meta.dir, "../.env"), "utf8");
    const value = envFile.match(/^MONGODB_URL=(.*)$/m)?.[1]?.trim();
    if (value) return value;
  } catch {
    // The package has no .env yet.
  }
  throw new Error("MONGODB_URL is not set. Add it to askjordan/.env.");
}

const url = mongodbUrl();

export const client = new MongoClient(url);
export const db = client.db();

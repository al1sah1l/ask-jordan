import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MongoClient, type Db } from "mongodb";

export interface TestDb {
  db: Db;
  close(): Promise<void>;
}

/** Bun loads `.env` from the shell's directory. Tests also run from the repo root, so look beside this package. */
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

/** Opens a fresh database for one test file in the MongoDB from compose.yaml. */
export async function openTestDb(): Promise<TestDb> {
  const url = mongodbUrl();

  const client = new MongoClient(url, { serverSelectionTimeoutMS: 3000 });
  try {
    await client.connect();
  } catch {
    throw new Error("Could not reach MongoDB. Start it with `bun run db:up`.");
  }
  const db = client.db(`test-${crypto.randomUUID()}`);

  return {
    db,
    async close() {
      await db.dropDatabase();
      await client.close();
    },
  };
}

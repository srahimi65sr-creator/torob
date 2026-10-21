import { mkdir } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "./schema";
import { seed } from "./seed";

export type Db = PgliteDatabase<typeof schema> & { $client: PGlite };

const MIGRATIONS = path.join(process.cwd(), "drizzle");

/** Opens a database, brings it to the latest schema and fills reference data. */
export async function openDb(dataDir?: string): Promise<Db> {
  // PGlite creates its own folder but not the ones above it.
  if (dataDir) await mkdir(path.dirname(dataDir), { recursive: true });
  const db = drizzle(new PGlite(dataDir), { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  await seed(db);
  return db;
}

let shared: Promise<Db> | undefined;

/**
 * The app's database. PGlite is Postgres running inside this process and stores its files in
 * `.data/pglite`, so the demo needs no database server. Moving to Neon only changes this file.
 */
export function getDb(): Promise<Db> {
  shared ??= openDb(process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite")).catch((error) => {
    shared = undefined; // let the next request try again instead of failing forever
    throw error;
  });
  return shared;
}

import type { PgliteDatabase } from "drizzle-orm/pglite";
import { VEHICLES } from "@/catalog/vehicles";
import { INSURERS, resolveInsurer } from "@/normalize/insurers";
import { createSources } from "@/sources";
import azki from "@/sources/sample/data/azki.json";
import bimebazar from "@/sources/sample/data/bimebazar.json";
import * as schema from "./schema";

const SAMPLE_FILES = { azki, bimebazar } as Record<string, { buyUrl: string; insurers: { insurerName: string }[] }>;

/** Reference data from the code's catalogs. Safe to run on every start: existing rows are kept. */
export async function seed(db: PgliteDatabase<typeof schema>): Promise<void> {
  await db
    .insert(schema.sources)
    .values(
      createSources().map((s) => ({
        slug: s.sourceId,
        name: s.displayName,
        baseUrl: new URL(SAMPLE_FILES[s.sourceId]?.buyUrl ?? "https://torob.com").origin,
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(schema.insurers)
    .values(INSURERS.map((i) => ({ slug: i.id, nameFa: i.name })))
    .onConflictDoNothing();

  await db
    .insert(schema.vehicleModels)
    .values(VEHICLES.map((v) => ({ slug: v.id, vehicleType: v.vehicleType, brandFa: v.brand, modelFa: v.model })))
    .onConflictDoNothing();

  // Aliases point at ids, so read the rows back (they may have existed before this run).
  const [allSources, allInsurers, allVehicles] = await Promise.all([
    db.select().from(schema.sources),
    db.select().from(schema.insurers),
    db.select().from(schema.vehicleModels),
  ]);
  const sourceId = (slug: string) => allSources.find((s) => s.slug === slug)!.id;

  const insurerAliases = Object.entries(SAMPLE_FILES).flatMap(([slug, file]) =>
    file.insurers.map((i) => ({
      sourceId: sourceId(slug),
      rawName: i.insurerName,
      insurerId: allInsurers.find((row) => row.slug === resolveInsurer(i.insurerName)?.id)!.id,
    })),
  );
  if (insurerAliases.length) await db.insert(schema.insurerAliases).values(insurerAliases).onConflictDoNothing();

  const vehicleAliases = VEHICLES.flatMap((v) =>
    Object.entries(v.sourceModelIds).map(([slug, sourceModelId]) => ({
      sourceId: sourceId(slug),
      sourceModelId,
      vehicleModelId: allVehicles.find((row) => row.slug === v.id)!.id,
    })),
  );
  if (vehicleAliases.length) await db.insert(schema.vehicleModelAliases).values(vehicleAliases).onConflictDoNothing();
}

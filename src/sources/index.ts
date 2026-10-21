import azki from "./sample/data/azki.json";
import bimebazar from "./sample/data/bimebazar.json";
import { SampleAdapter } from "./sample/adapter";
import type { SourceAdapter } from "./types";

/** Every source the app asks. Swapping a sample for a real API adapter happens only here. */
export function createSources(): SourceAdapter[] {
  return [
    new SampleAdapter("azki", "ازکی", azki),
    new SampleAdapter("bimebazar", "بیمه بازار", bimebazar),
  ];
}

const NAMES = Object.fromEntries(createSources().map((s) => [s.sourceId, s.displayName]));

/** Display name of a seller, or null for an id we don't know. */
export function sourceName(sourceId: string): string | null {
  return NAMES[sourceId] ?? null;
}

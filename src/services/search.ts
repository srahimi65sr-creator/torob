import type { LlmParser } from "@/ai/llm-parser";
import { parseQuery } from "@/ai/parse-query";
import { VEHICLES, VEHICLE_TYPES, findVehicle } from "@/catalog/vehicles";
import { compareOffers, type InsurerGroup, type SortKey } from "@/domain/compare";
import {
  QUOTE_FIELDS,
  buildYearError,
  discountError,
  type QuoteField,
  type QuoteRequest,
} from "@/domain/quote-request";
import type { SourceAdapter } from "@/sources/types";
import { getOffers, type QuoteStore } from "./quote-service";

/** What the search page receives in its URL. Explicit fields win over what is parsed from `q`. */
export interface SearchParams {
  q?: string;
  type?: string;
  model?: string;
  year?: string;
  discount?: string;
  sort?: string;
}

export type SearchView =
  | {
      kind: "ask";
      known: Partial<QuoteRequest>;
      /** Fields to ask, in order, each with the reason it is asked again when a value was rejected. */
      ask: { field: QuoteField; error: string | null }[];
    }
  | { kind: "not-found" }
  | {
      kind: "results";
      request: QuoteRequest;
      sort: SortKey;
      groups: InsurerGroup[];
      sellerCount: number;
      failedSources: string[];
      quoteRequestId: number | null;
    };

const toInt = (v: string | undefined) => (v && /^\d+$/.test(v) ? Number(v) : undefined);

export function parseSort(value: string | undefined): SortKey {
  return value === "installment" ? "installmentTotal" : "cash";
}

export interface SearchDeps {
  sources: SourceAdapter[];
  store?: QuoteStore;
  now?: Date;
  /** Reads sentences the rules leave partly unread. Optional: without it the rules alone decide. */
  llm?: LlmParser;
}

/** Who understood the sentence, kept in the search log to measure each reader. */
export type ParsedBy = "rules" | "llm";

export async function resolveSearch(params: SearchParams, deps: SearchDeps): Promise<SearchView> {
  const reading = await read(params.q ?? "", deps.llm);
  const view = await decide(params, reading, deps);
  // Free text and what we made of it, kept to measure the readers later.
  const q = params.q?.trim();
  if (q && deps.store) {
    const quoteRequestId = view.kind === "results" ? view.quoteRequestId : null;
    await deps.store.logSearch(q, { fields: reading.fields, parsedBy: reading.parsedBy, outcome: view.kind }, quoteRequestId);
  }
  return view;
}

interface Reading {
  fields: Partial<QuoteRequest>;
  /** The user named something we could not match to a catalog vehicle. */
  unknownVehicle: boolean;
  parsedBy: ParsedBy;
}

/**
 * Rules first: fast, free and tested. Only when they leave words unread does the model get the
 * sentence; it fills what the rules missed and never overrides what they found.
 */
async function read(q: string, llm: LlmParser | undefined): Promise<Reading> {
  const rules = parseQuery(q, VEHICLES);
  const fromRules: Reading = {
    fields: rules.fields,
    unknownVehicle: !rules.fields.vehicleModelId && rules.leftover !== "",
    parsedBy: "rules",
  };
  if (!llm || rules.leftover === "") return fromRules;

  const model = await llm(q, VEHICLES);
  if (!model) return fromRules;
  const fields = { ...model.fields, ...rules.fields };
  return { fields, unknownVehicle: !fields.vehicleModelId && model.unknownVehicle, parsedBy: "llm" };
}

async function decide(params: SearchParams, reading: Reading, { sources, store, now }: SearchDeps): Promise<SearchView> {
  const known: Partial<QuoteRequest> = { ...reading.fields };

  if (params.model !== undefined) {
    const vehicle = findVehicle(params.model);
    if (!vehicle) return { kind: "not-found" };
    known.vehicleModelId = vehicle.id;
    known.vehicleType = vehicle.vehicleType;
  }
  if (params.type !== undefined) {
    if (!VEHICLE_TYPES.includes(params.type)) return { kind: "not-found" };
    known.vehicleType = params.type;
  }
  const year = toInt(params.year);
  if (year !== undefined) known.buildYear = year;
  const discount = toInt(params.discount);
  if (discount !== undefined) known.discountPercent = discount;

  // The user named a vehicle we don't have: Torob's own "not found".
  if (!known.vehicleModelId && reading.unknownVehicle) return { kind: "not-found" };

  const errors: Partial<Record<QuoteField, string>> = {};
  if (known.buildYear !== undefined) {
    const e = buildYearError(known.buildYear, now);
    if (e) {
      errors.buildYear = e;
      delete known.buildYear;
    }
  }
  if (known.discountPercent !== undefined) {
    const e = discountError(known.discountPercent);
    if (e) {
      errors.discountPercent = e;
      delete known.discountPercent;
    }
  }

  const ask = QUOTE_FIELDS.filter((f) => known[f] === undefined).map((field) => ({
    field,
    error: errors[field] ?? null,
  }));
  if (ask.length) return { kind: "ask", known, ask };

  const request = known as QuoteRequest;
  const sort = parseSort(params.sort);
  const { offers, failedSources, quoteRequestId } = await getOffers(request, sources, store, now);
  if (!offers.length) return { kind: "not-found" };

  return {
    kind: "results",
    request,
    sort,
    groups: compareOffers(offers, { sort }),
    sellerCount: new Set(offers.map((o) => o.sourceId)).size,
    failedSources,
    quoteRequestId,
  };
}

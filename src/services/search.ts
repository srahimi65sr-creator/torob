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
}

export async function resolveSearch(params: SearchParams, deps: SearchDeps): Promise<SearchView> {
  const view = await decide(params, deps);
  // Free text and what we made of it, kept to measure the parser later.
  const q = params.q?.trim();
  if (q && deps.store) {
    const fields = parseQuery(q, VEHICLES).fields;
    const quoteRequestId = view.kind === "results" ? view.quoteRequestId : null;
    await deps.store.logSearch(q, { fields, outcome: view.kind }, quoteRequestId);
  }
  return view;
}

async function decide(params: SearchParams, { sources, store, now }: SearchDeps): Promise<SearchView> {
  const parsed = parseQuery(params.q ?? "", VEHICLES);
  const known: Partial<QuoteRequest> = { ...parsed.fields };

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
  if (!known.vehicleModelId && parsed.leftover) return { kind: "not-found" };

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

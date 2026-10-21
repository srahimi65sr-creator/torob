import { findVehicle } from "@/catalog/vehicles";
import type { Offer } from "@/domain/offer";
import type { QuoteRequest } from "@/domain/quote-request";
import { toOffers, type MapIssue } from "@/normalize/price";
import type { SourceAdapter } from "@/sources/types";

/** A source's answer as it is kept: successful or not, with the raw payload. */
export interface StoredResponse {
  status: "ok" | "failed";
  receivedAt: string;
  error?: string;
  rawPayload?: unknown;
}

/** Cache and history. Implemented on Postgres in `db/`; the service works without one too. */
export interface QuoteStore {
  requestId(request: QuoteRequest): Promise<number>;
  freshOffers(sourceSlug: string, quoteRequestId: number, since: Date): Promise<Offer[] | null>;
  saveResponse(sourceSlug: string, quoteRequestId: number, response: StoredResponse, offers: Offer[]): Promise<void>;
  logSearch(rawText: string, parsed: unknown, quoteRequestId: number | null): Promise<void>;
}

/** A source answer younger than this is served from the database instead of asking again. */
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface QuoteResult {
  offers: Offer[];
  issues: (MapIssue & { sourceId: string })[];
  failedSources: string[];
  /** Sources answered from the database rather than asked. */
  cachedSources: string[];
  quoteRequestId: number | null;
}

/** Asks every source for the vehicle in parallel. A failing source does not hide the others. */
export async function getOffers(
  request: QuoteRequest,
  sources: SourceAdapter[],
  store?: QuoteStore,
  now: Date = new Date(),
): Promise<QuoteResult> {
  const result: QuoteResult = { offers: [], issues: [], failedSources: [], cachedSources: [], quoteRequestId: null };
  const vehicle = findVehicle(request.vehicleModelId);
  if (!vehicle) return result;

  const quoteRequestId = store ? await store.requestId(request) : null;
  result.quoteRequestId = quoteRequestId;
  const since = new Date(now.getTime() - CACHE_TTL_MS);

  const asked = sources.filter((s) => vehicle.sourceModelIds[s.sourceId]);
  const outcomes = await Promise.allSettled(
    asked.map(async (s) => {
      if (store && quoteRequestId !== null) {
        const cached = await store.freshOffers(s.sourceId, quoteRequestId, since);
        if (cached) return { sourceId: s.sourceId, offers: cached, issues: [], cached: true };
      }
      try {
        const response = await s.fetchQuotes(request, vehicle.sourceModelIds[s.sourceId]);
        const mapped = toOffers(s.sourceId, response.quotes, response.receivedAt);
        if (store && quoteRequestId !== null) {
          await store.saveResponse(
            s.sourceId,
            quoteRequestId,
            { status: "ok", receivedAt: response.receivedAt, rawPayload: response.rawPayload },
            mapped.offers,
          );
        }
        return { sourceId: s.sourceId, ...mapped, cached: false };
      } catch (error) {
        if (store && quoteRequestId !== null) {
          await store.saveResponse(
            s.sourceId,
            quoteRequestId,
            { status: "failed", receivedAt: now.toISOString(), error: String(error) },
            [],
          );
        }
        throw error;
      }
    }),
  );

  outcomes.forEach((o, i) => {
    if (o.status === "fulfilled") {
      result.offers.push(...o.value.offers);
      result.issues.push(...o.value.issues.map((issue) => ({ ...issue, sourceId: o.value.sourceId })));
      if (o.value.cached) result.cachedSources.push(o.value.sourceId);
    } else {
      result.failedSources.push(asked[i].sourceId);
    }
  });
  return result;
}

/** The database layer: schema, seed, cache and history. Each test gets a fresh in-memory Postgres. */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { count, eq } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "@/db/client";
import { DbQuoteStore } from "@/db/quote-store";
import { seed } from "@/db/seed";
import * as t from "@/db/schema";
import type { QuoteRequest } from "@/domain/quote-request";
import { createSources } from "@/sources";
import type { SourceAdapter } from "@/sources/types";
import { CACHE_TTL_MS, getOffers } from "@/services/quote-service";
import { resolveSearch } from "@/services/search";

const request: QuoteRequest = { vehicleType: "سواری", vehicleModelId: "pride-131", buildYear: 1398, discountPercent: 20 };

let db: Db;
let store: DbQuoteStore;

beforeEach(async () => {
  db = await openDb();
  store = new DbQuoteStore(db);
});

const rows = async (table: PgTable) => (await db.select({ n: count() }).from(table))[0].n;

/** Wraps a source to count how often it is really asked. */
function counting(source: SourceAdapter) {
  let calls = 0;
  const wrapped: SourceAdapter = {
    sourceId: source.sourceId,
    displayName: source.displayName,
    listVehicles: () => source.listVehicles(),
    fetchQuotes: (r, id) => {
      calls++;
      return source.fetchQuotes(r, id);
    },
  };
  return { wrapped, calls: () => calls };
}

const byKey = (offers: { sourceId: string; insurerId: string }[]) =>
  [...offers].sort((a, b) => `${a.sourceId}${a.insurerId}`.localeCompare(`${b.sourceId}${b.insurerId}`));

describe("opening", () => {
  it("creates a data folder that does not exist yet, and keeps data across reopen", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "torob-bime-"));
    const dir = path.join(root, "nested", "pglite");
    try {
      const first = await openDb(dir);
      await new DbQuoteStore(first).requestId(request);
      await first.$client.close();

      const reopened = await openDb(dir);
      expect((await reopened.select({ n: count() }).from(t.quoteRequests))[0].n).toBe(1);
      await reopened.$client.close();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("seed", () => {
  it("fills reference data from the code catalogs", async () => {
    expect(await rows(t.sources)).toBe(2);
    expect(await rows(t.insurers)).toBe(21);
    expect(await rows(t.vehicleModels)).toBe(2);
    expect(await rows(t.insurerAliases)).toBe(10);
    expect(await rows(t.vehicleModelAliases)).toBe(4);
  });

  it("can run again without duplicating anything", async () => {
    await seed(db);
    expect(await rows(t.insurers)).toBe(21);
    expect(await rows(t.insurerAliases)).toBe(10);
  });

  it("maps each source's spelling to the canonical insurer", async () => {
    const [alias] = await db
      .select({ slug: t.insurers.slug })
      .from(t.insurerAliases)
      .innerJoin(t.insurers, eq(t.insurers.id, t.insurerAliases.insurerId))
      .where(eq(t.insurerAliases.rawName, "آسیا"));
    expect(alias.slug).toBe("asia");
  });
});

describe("quote cache", () => {
  it("the same request gets the same id", async () => {
    expect(await store.requestId(request)).toBe(await store.requestId({ ...request }));
    expect(await store.requestId({ ...request, discountPercent: 25 })).not.toBe(await store.requestId(request));
  });

  it("stores every source's answer, then serves the next search from the database", async () => {
    const sources = createSources().map(counting);
    const first = await getOffers(request, sources.map((s) => s.wrapped), store);
    expect(first.cachedSources).toEqual([]);
    expect(await rows(t.sourceResponses)).toBe(2);
    expect(await rows(t.offers)).toBe(10);
    expect(await rows(t.paymentPlans)).toBe(10 + 7); // a cash plan each + 7 installment plans

    const second = await getOffers(request, sources.map((s) => s.wrapped), store);
    expect(second.cachedSources.sort()).toEqual(["azki", "bimebazar"]);
    expect(sources.map((s) => s.calls())).toEqual([1, 1]);
    expect(byKey(second.offers)).toEqual(byKey(first.offers));
  });

  it("asks the source again once the cached answer is older than 24 hours", async () => {
    const sources = createSources().map(counting);
    await getOffers(request, sources.map((s) => s.wrapped), store);
    const later = new Date(Date.now() + CACHE_TTL_MS + 60_000);
    const again = await getOffers(request, sources.map((s) => s.wrapped), store, later);
    expect(again.cachedSources).toEqual([]);
    expect(sources.map((s) => s.calls())).toEqual([2, 2]);
  });

  it("records a failing source and still returns the others", async () => {
    const [azki] = createSources();
    const broken: SourceAdapter = {
      sourceId: "bimebazar",
      displayName: "بیمه بازار",
      listVehicles: async () => [],
      fetchQuotes: async () => {
        throw new Error("timeout");
      },
    };
    const result = await getOffers(request, [azki, broken], store);
    expect(result.failedSources).toEqual(["bimebazar"]);
    expect(result.offers.every((o) => o.sourceId === "azki")).toBe(true);
    const failed = await db.select().from(t.sourceResponses).where(eq(t.sourceResponses.status, "failed"));
    expect(failed).toHaveLength(1);
    expect(failed[0].error).toMatch(/timeout/);
  });
});

describe("search log", () => {
  it("keeps what the user typed, what was understood and how it ended", async () => {
    await resolveSearch({ q: "پراید ۹۸ تخفیف ۲۰ درصد" }, { sources: createSources(), store });
    await resolveSearch({ q: "پیکان وانت" }, { sources: createSources(), store });
    const logs = await db.select().from(t.searchLogs).orderBy(t.searchLogs.id);
    expect(logs.map((l) => (l.parsedRequest as { outcome: string }).outcome)).toEqual(["results", "not-found"]);
    expect(logs[0].quoteRequestId).not.toBeNull();
    expect(logs[1].quoteRequestId).toBeNull();
  });
});

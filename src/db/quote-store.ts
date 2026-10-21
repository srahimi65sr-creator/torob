import { createHash } from "node:crypto";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import type { Offer } from "@/domain/offer";
import type { PaymentPlan } from "@/domain/payment-plan";
import { requestKey, type QuoteRequest } from "@/domain/quote-request";
import type { QuoteStore, StoredResponse } from "@/services/quote-service";
import type { Db } from "./client";
import * as t from "./schema";

export function requestHash(request: QuoteRequest): string {
  return createHash("sha256").update(requestKey(request)).digest("hex");
}

/** Postgres implementation of the cache and history the quote service needs. */
export class DbQuoteStore implements QuoteStore {
  constructor(private readonly db: Db) {}

  private async idOf<T extends { id: number; slug: string }>(rows: T[], slug: string, what: string) {
    const row = rows.find((r) => r.slug === slug);
    if (!row) throw new Error(`Unknown ${what} "${slug}"`);
    return row.id;
  }

  async requestId(request: QuoteRequest): Promise<number> {
    const vehicles = await this.db.select().from(t.vehicleModels);
    const vehicleModelId = await this.idOf(vehicles, request.vehicleModelId, "vehicle");
    const hash = requestHash(request);
    const [row] = await this.db
      .insert(t.quoteRequests)
      .values({
        requestHash: hash,
        vehicleType: request.vehicleType,
        vehicleModelId,
        buildYear: request.buildYear,
        discountPercent: request.discountPercent,
      })
      .onConflictDoUpdate({ target: t.quoteRequests.requestHash, set: { requestHash: hash } })
      .returning({ id: t.quoteRequests.id });
    return row.id;
  }

  async freshOffers(sourceSlug: string, quoteRequestId: number, since: Date): Promise<Offer[] | null> {
    const [response] = await this.db
      .select({ id: t.sourceResponses.id })
      .from(t.sourceResponses)
      .innerJoin(t.sources, eq(t.sources.id, t.sourceResponses.sourceId))
      .where(
        and(
          eq(t.sources.slug, sourceSlug),
          eq(t.sourceResponses.quoteRequestId, quoteRequestId),
          eq(t.sourceResponses.status, "ok"),
          gte(t.sourceResponses.receivedAt, since),
        ),
      )
      .orderBy(desc(t.sourceResponses.receivedAt))
      .limit(1);
    if (!response) return null;

    const rows = await this.db
      .select({ offer: t.offers, insurer: t.insurers })
      .from(t.offers)
      .innerJoin(t.insurers, eq(t.insurers.id, t.offers.insurerId))
      .where(eq(t.offers.sourceResponseId, response.id))
      .orderBy(t.offers.id);
    const plans = rows.length
      ? await this.db
          .select()
          .from(t.paymentPlans)
          .where(inArray(t.paymentPlans.offerId, rows.map((r) => r.offer.id)))
          .orderBy(t.paymentPlans.id)
      : [];

    return rows.map(({ offer, insurer }) => ({
      sourceId: sourceSlug,
      insurerId: insurer.slug,
      insurerName: insurer.nameFa,
      basePrice: offer.basePrice,
      discountAmount: offer.discountAmount,
      finalCashPrice: offer.finalCashPrice,
      coverageAmount: offer.coverageAmount,
      buyUrl: offer.buyUrl,
      fetchedAt: offer.fetchedAt.toISOString(),
      plans: plans
        .filter((p) => p.offerId === offer.id)
        .map(
          (p): PaymentPlan =>
            p.kind === "cash"
              ? { kind: "cash", total: p.totalPayable }
              : {
                  kind: "installment",
                  months: p.months!,
                  downPayment: p.downPayment!,
                  installmentAmount: p.installmentAmount!,
                  totalPayable: p.totalPayable,
                },
        ),
    }));
  }

  async saveResponse(sourceSlug: string, quoteRequestId: number, response: StoredResponse, offers: Offer[]) {
    const [sources, insurers] = await Promise.all([
      this.db.select().from(t.sources),
      this.db.select().from(t.insurers),
    ]);
    const sourceId = await this.idOf(sources, sourceSlug, "source");

    await this.db.transaction(async (tx) => {
      const [saved] = await tx
        .insert(t.sourceResponses)
        .values({
          sourceId,
          quoteRequestId,
          status: response.status,
          receivedAt: new Date(response.receivedAt),
          error: response.error ?? null,
          rawPayload: response.rawPayload ?? null,
        })
        .returning({ id: t.sourceResponses.id });

      for (const offer of offers) {
        const [row] = await tx
          .insert(t.offers)
          .values({
            sourceResponseId: saved.id,
            quoteRequestId,
            sourceId,
            insurerId: await this.idOf(insurers, offer.insurerId, "insurer"),
            basePrice: offer.basePrice,
            discountAmount: offer.discountAmount,
            finalCashPrice: offer.finalCashPrice,
            coverageAmount: offer.coverageAmount,
            buyUrl: offer.buyUrl,
            fetchedAt: new Date(offer.fetchedAt),
          })
          .returning({ id: t.offers.id });
        await tx.insert(t.paymentPlans).values(
          offer.plans.map((p) =>
            p.kind === "cash"
              ? { offerId: row.id, kind: "cash" as const, totalPayable: p.total }
              : {
                  offerId: row.id,
                  kind: "installment" as const,
                  months: p.months,
                  downPayment: p.downPayment,
                  installmentAmount: p.installmentAmount,
                  totalPayable: p.totalPayable,
                },
          ),
        );
      }
    });
  }

  async logSearch(rawText: string, parsed: unknown, quoteRequestId: number | null) {
    await this.db.insert(t.searchLogs).values({ rawText, parsedRequest: parsed ?? {}, quoteRequestId });
  }
}

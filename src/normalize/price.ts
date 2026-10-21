import type { Offer } from "@/domain/offer";
import type { PaymentPlan } from "@/domain/payment-plan";
import type { RawQuote } from "@/sources/types";
import { resolveInsurer } from "./insurers";

export type MapIssue =
  | { kind: "unknown-insurer"; rawName: string }
  | { kind: "price-mismatch"; rawName: string; expected: number; got: number };

export interface MapResult {
  offers: Offer[];
  issues: MapIssue[];
}

/** Rounding in a source's own math can leave a few Toman of difference. */
const PRICE_TOLERANCE = 1000;

export function toOffers(sourceId: string, quotes: RawQuote[], fetchedAt: string): MapResult {
  const offers: Offer[] = [];
  const issues: MapIssue[] = [];

  for (const q of quotes) {
    const insurer = resolveInsurer(q.insurerName);
    if (!insurer) {
      issues.push({ kind: "unknown-insurer", rawName: q.insurerName });
      continue;
    }

    const expected = q.basePrice - q.discountAmount;
    if (Math.abs(expected - q.finalCashPrice) > PRICE_TOLERANCE) {
      // Keep the offer: the source's final price is what the user pays. Just flag it.
      issues.push({ kind: "price-mismatch", rawName: q.insurerName, expected, got: q.finalCashPrice });
    }

    const plans: PaymentPlan[] = [
      { kind: "cash", total: q.finalCashPrice },
      ...q.installments.map((i) => ({
        kind: "installment" as const,
        months: i.months,
        downPayment: i.downPayment,
        installmentAmount: i.installmentAmount,
        totalPayable: i.downPayment + i.months * i.installmentAmount,
      })),
    ];

    offers.push({
      sourceId,
      insurerId: insurer.id,
      insurerName: insurer.name,
      basePrice: q.basePrice,
      discountAmount: q.discountAmount,
      finalCashPrice: q.finalCashPrice,
      coverageAmount: q.coverageAmount,
      plans,
      buyUrl: q.buyUrl,
      fetchedAt,
    });
  }

  return { offers, issues };
}

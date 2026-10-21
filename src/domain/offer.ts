import type { PaymentPlan } from "./payment-plan";

export type SourceId = string;
export type InsurerId = string;

/** One insurer's price from one source, already normalized. Amounts are in Toman. */
export interface Offer {
  sourceId: SourceId;
  insurerId: InsurerId;
  insurerName: string;
  basePrice: number;
  discountAmount: number;
  finalCashPrice: number;
  coverageAmount: number | null;
  plans: PaymentPlan[];
  buyUrl: string;
  fetchedAt: string;
}

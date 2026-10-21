import type { Offer } from "@/domain/offer";
import type { PaymentPlan } from "@/domain/payment-plan";

export function offer(partial: Partial<Offer> & { insurerId: string; finalCashPrice: number }): Offer {
  const plans: PaymentPlan[] = partial.plans ?? [{ kind: "cash", total: partial.finalCashPrice }];
  return {
    sourceId: "azki",
    insurerName: partial.insurerId,
    basePrice: partial.finalCashPrice,
    discountAmount: 0,
    coverageAmount: null,
    buyUrl: "https://example.com",
    fetchedAt: "2026-10-21T00:00:00.000Z",
    ...partial,
    plans,
  };
}

export function installment(months: number, downPayment: number, installmentAmount: number): PaymentPlan {
  return {
    kind: "installment",
    months,
    downPayment,
    installmentAmount,
    totalPayable: downPayment + months * installmentAmount,
  };
}

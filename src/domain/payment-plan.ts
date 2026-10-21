/** Amounts are in Toman. */
export type PaymentPlan =
  | { kind: "cash"; total: number }
  | {
      kind: "installment";
      months: number;
      downPayment: number;
      installmentAmount: number;
      totalPayable: number;
    };

export type InstallmentPlan = Extract<PaymentPlan, { kind: "installment" }>;

export function installmentPlans(plans: PaymentPlan[]): InstallmentPlan[] {
  return plans.filter((p): p is InstallmentPlan => p.kind === "installment");
}

/** Cheapest total among installment plans, or null when the offer has none. */
export function cheapestInstallmentTotal(plans: PaymentPlan[]): number | null {
  const totals = installmentPlans(plans).map((p) => p.totalPayable);
  return totals.length ? Math.min(...totals) : null;
}

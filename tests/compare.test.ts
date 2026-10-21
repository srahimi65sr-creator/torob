import { describe, expect, it } from "vitest";
import { compareOffers } from "@/domain/compare";
import { installment, offer } from "./helpers";

describe("compareOffers", () => {
  it("puts the cheapest cash price first", () => {
    const groups = compareOffers(
      [offer({ insurerId: "iran", finalCashPrice: 9_000_000 }), offer({ insurerId: "asia", finalCashPrice: 8_000_000 })],
      { sort: "cash" },
    );
    expect(groups.map((g) => g.insurerId)).toEqual(["asia", "iran"]);
  });

  it("groups one insurer across sources and shows its cheapest source", () => {
    const groups = compareOffers(
      [
        offer({ insurerId: "iran", sourceId: "azki", finalCashPrice: 9_000_000 }),
        offer({ insurerId: "iran", sourceId: "bimebazar", finalCashPrice: 8_500_000 }),
      ],
      { sort: "cash" },
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].best.sourceId).toBe("bimebazar");
    expect(groups[0].offers).toHaveLength(2);
  });

  it("sorts by installment total and drops offers without installments", () => {
    const cashOnly = offer({ insurerId: "alborz", finalCashPrice: 7_000_000 });
    const cheapCashDearInstallment = offer({
      insurerId: "iran",
      finalCashPrice: 8_000_000,
      plans: [{ kind: "cash", total: 8_000_000 }, installment(6, 2_000_000, 1_200_000)],
    });
    const dearCashCheapInstallment = offer({
      insurerId: "asia",
      finalCashPrice: 8_200_000,
      plans: [{ kind: "cash", total: 8_200_000 }, installment(6, 2_000_000, 1_100_000)],
    });

    const groups = compareOffers([cashOnly, cheapCashDearInstallment, dearCashCheapInstallment], {
      sort: "installmentTotal",
    });
    expect(groups.map((g) => g.insurerId)).toEqual(["asia", "iran"]);
  });

  it("filters by insurer and source", () => {
    const offers = [
      offer({ insurerId: "iran", sourceId: "azki", finalCashPrice: 9_000_000 }),
      offer({ insurerId: "asia", sourceId: "bimebazar", finalCashPrice: 8_000_000 }),
    ];
    expect(compareOffers(offers, { sort: "cash", sourceIds: ["azki"] }).map((g) => g.insurerId)).toEqual(["iran"]);
    expect(compareOffers(offers, { sort: "cash", insurerIds: ["asia"] }).map((g) => g.insurerId)).toEqual(["asia"]);
  });
});

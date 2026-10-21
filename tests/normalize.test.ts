import { describe, expect, it } from "vitest";
import { resolveInsurer } from "@/normalize/insurers";
import { toOffers } from "@/normalize/price";
import { normalizePersian } from "@/normalize/text";
import type { RawQuote } from "@/sources/types";

const raw = (partial: Partial<RawQuote>): RawQuote => ({
  insurerName: "بیمه ایران",
  basePrice: 10_000_000,
  discountAmount: 1_000_000,
  finalCashPrice: 9_000_000,
  coverageAmount: null,
  buyUrl: "https://example.com",
  installments: [],
  ...partial,
});

describe("normalizePersian", () => {
  it("unifies Arabic letters, digits and half-spaces", () => {
    expect(normalizePersian("پژو ۲۰۶ تيپ ٢")).toBe("پژو 206 تیپ 2");
    expect(normalizePersian("ایران‌خودرو")).toBe("ایران خودرو");
  });
});

describe("resolveInsurer", () => {
  it("maps each source's spelling to one insurer", () => {
    expect(resolveInsurer("بیمه ایران")?.id).toBe("iran");
    expect(resolveInsurer("ايران")?.id).toBe("iran");
    expect(resolveInsurer("بیمه ما")?.id).toBe("ma");
    expect(resolveInsurer("ما")?.id).toBe("ma");
  });

  it("returns null for an unknown insurer instead of guessing", () => {
    expect(resolveInsurer("بیمه ناشناخته")).toBeNull();
  });
});

describe("toOffers", () => {
  it("adds a cash plan and computes each installment total", () => {
    const { offers, issues } = toOffers(
      "azki",
      [raw({ installments: [{ months: 6, downPayment: 2_000_000, installmentAmount: 1_250_000 }] })],
      "2026-10-21T00:00:00.000Z",
    );
    expect(issues).toEqual([]);
    expect(offers[0].plans).toEqual([
      { kind: "cash", total: 9_000_000 },
      { kind: "installment", months: 6, downPayment: 2_000_000, installmentAmount: 1_250_000, totalPayable: 9_500_000 },
    ]);
  });

  it("skips unknown insurers and flags them", () => {
    const { offers, issues } = toOffers("azki", [raw({ insurerName: "بیمه ناشناخته" })], "x");
    expect(offers).toEqual([]);
    expect(issues).toEqual([{ kind: "unknown-insurer", rawName: "بیمه ناشناخته" }]);
  });

  it("keeps the source's final price but flags a base minus discount mismatch", () => {
    const { offers, issues } = toOffers("azki", [raw({ finalCashPrice: 8_000_000 })], "x");
    expect(offers[0].finalCashPrice).toBe(8_000_000);
    expect(issues[0]).toMatchObject({ kind: "price-mismatch", expected: 9_000_000, got: 8_000_000 });
  });
});

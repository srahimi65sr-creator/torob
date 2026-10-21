import { describe, expect, it } from "vitest";
import type { QuoteRequest } from "@/domain/quote-request";
import { toOffers } from "@/normalize/price";
import { createSources } from "@/sources";
import { SampleAdapter } from "@/sources/sample/adapter";

const request: QuoteRequest = {
  vehicleType: "سواری",
  vehicleModelId: "pride-131",
  buildYear: 1398,
  discountPercent: 20,
};

describe("sample data", () => {
  it.each(createSources())("$sourceId maps every quote without issues", async (source) => {
    for (const vehicle of await source.listVehicles()) {
      const response = await source.fetchQuotes(request, vehicle.sourceModelId);
      const { offers, issues } = toOffers(source.sourceId, response.quotes, response.receivedAt);
      expect(issues).toEqual([]);
      expect(offers.length).toBeGreaterThan(0);
    }
  });

  it("prices = base × (1 − user discount − insurer extra), rounded to 1,000 Toman", async () => {
    const [azki] = createSources();
    const { quotes } = await azki.fetchQuotes(request, "pride-131");
    const asia = quotes.find((q) => q.insurerName === "بیمه آسیا")!;
    // 8,944,000 × 22% = 1,967,680 → 1,968,000
    expect(asia.discountAmount).toBe(1_968_000);
    expect(asia.finalCashPrice).toBe(8_944_000 - 1_968_000);
  });

  it("returns no quotes for a vehicle the sample does not have", async () => {
    const [source] = createSources();
    const response = await source.fetchQuotes(request, "unknown-model");
    expect(response.quotes).toEqual([]);
  });

  it("rejects a sample file that belongs to another source", () => {
    const file = { placeholder: true, sourceId: "azki", buyUrl: "https://example.com", vehicles: [], insurers: [] };
    expect(() => new SampleAdapter("azki", "x", file)).not.toThrow();
    expect(() => new SampleAdapter("bimebazar", "x", file)).toThrow(/not "bimebazar"/);
  });
});

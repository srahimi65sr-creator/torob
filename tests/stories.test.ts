/**
 * Scenario tests, one per test case in the "یوزر استوری و تست" tab of the design doc.
 * Each name starts with its TC code so a failure points straight at the story.
 */
import { describe, expect, it } from "vitest";
import { parseQuery } from "@/ai/parse-query";
import { VEHICLES } from "@/catalog/vehicles";
import { cheapestInstallmentTotal } from "@/domain/payment-plan";
import { createSources } from "@/sources";
import { resolveSearch, type SearchParams, type SearchView } from "@/services/search";
import { resolveSelection, selectionMessage } from "@/services/selection";

const NOW = new Date("2026-10-21T12:00:00Z"); // 29 Mehr 1405
const search = (params: SearchParams) => resolveSearch(params, { sources: createSources(), now: NOW });
const parse = (q: string) => parseQuery(q, VEHICLES).fields;

function asked(view: SearchView) {
  if (view.kind !== "ask") throw new Error(`expected "ask", got "${view.kind}"`);
  return view.ask.map((a) => a.field);
}

function results(view: SearchView) {
  if (view.kind !== "results") throw new Error(`expected "results", got "${view.kind}"`);
  return view;
}

describe("US1: typed specs become fields", () => {
  it("TC1.1 پراید ۱۳۱ مدل ۹۸ با ۲۰ درصد تخفیف", () => {
    expect(parse("پراید ۱۳۱ مدل ۹۸ با ۲۰ درصد تخفیف")).toEqual({
      vehicleType: "سواری",
      vehicleModelId: "pride-131",
      buildYear: 1398,
      discountPercent: 20,
    });
  });

  it("TC1.2 Latin digits and the ٪ sign", () => {
    expect(parse("پژو 206 تیپ 2 سال 1400 تخفیف 35٪")).toEqual({
      vehicleType: "سواری",
      vehicleModelId: "peugeot-206-t2",
      buildYear: 1400,
      discountPercent: 35,
    });
  });

  it("TC1.3 years of discount become a percent", () => {
    expect(parse("پراید ۹۵، ۴ سال تخفیف")).toMatchObject({
      vehicleModelId: "pride-131",
      buildYear: 1395,
      discountPercent: 20,
    });
  });

  it("TC1.4 بدون تخفیف is zero percent", () => {
    expect(parse("۲۰۶ مدل ۱۳۹۹ بدون تخفیف")).toMatchObject({
      vehicleModelId: "peugeot-206-t2",
      buildYear: 1399,
      discountPercent: 0,
    });
  });
});

describe("US2: ask only what is missing", () => {
  it("TC2.1 only a model: asks build year and discount", async () => {
    const view = await search({ q: "پراید" });
    expect(asked(view)).toEqual(["buildYear", "discountPercent"]);
    // What is not known must be absent, not present with an undefined value.
    if (view.kind === "ask") expect(view.known).toEqual({ vehicleType: "سواری", vehicleModelId: "pride-131" });
  });

  it("TC2.2 no model: asks vehicle type and model", async () => {
    expect(asked(await search({ q: "مدل ۱۴۰۰ تخفیف ۱۰ درصد" }))).toEqual(["vehicleType", "vehicleModelId"]);
  });

  it("TC2.3 answering keeps what was already known", async () => {
    const first = await search({ q: "پراید" });
    if (first.kind !== "ask") throw new Error("expected ask");
    // The form sends known fields as hidden inputs plus the answers.
    const view = results(
      await search({ type: first.known.vehicleType, model: first.known.vehicleModelId, year: "1398", discount: "20" }),
    );
    expect(view.request).toEqual({ vehicleType: "سواری", vehicleModelId: "pride-131", buildYear: 1398, discountPercent: 20 });
  });

  it("TC2.4 empty search asks all four fields", async () => {
    expect(asked(await search({ q: "" }))).toEqual(["vehicleType", "vehicleModelId", "buildYear", "discountPercent"]);
  });
});

describe("US3: required fields and their ranges", () => {
  it("TC3.1 discount above 70% is asked again", async () => {
    const view = await search({ q: "پراید ۹۸ تخفیف ۸۰ درصد" });
    expect(view).toMatchObject({ kind: "ask", ask: [{ field: "discountPercent", error: "حداکثر 70 درصد" }] });
  });

  it("TC3.2 build year before 1370 is asked again", async () => {
    const view = await search({ q: "پراید مدل ۱۳۴۰ تخفیف ۲۰" });
    expect(view).toMatchObject({ kind: "ask", ask: [{ field: "buildYear" }] });
    if (view.kind === "ask") expect(view.ask[0].error).toMatch(/1370/);
  });

  it("TC3.3 discount must be a multiple of 5", async () => {
    const view = await search({ q: "پراید ۹۸ تخفیف ۱۲ درصد" });
    expect(view).toMatchObject({ kind: "ask", ask: [{ field: "discountPercent", error: "درصد تخفیف باید ضریب 5 باشه" }] });
  });
});

describe("US4: companies from every seller, by final price", () => {
  it("TC4.1 7 companies from 10 prices, cheapest first", async () => {
    const view = results(await search({ q: "پراید ۹۸ تخفیف ۲۰ درصد" }));
    expect(view.groups).toHaveLength(7);
    expect(view.groups.flatMap((g) => g.offers)).toHaveLength(10);
    const prices = view.groups.map((g) => g.best.finalCashPrice);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    expect(view.sellerCount).toBe(2);
  });

  it("TC4.2 the user's discount lowers every price", async () => {
    const at = async (discount: string) =>
      results(await search({ model: "pride-131", year: "1398", discount })).groups.flatMap((g) => g.offers);
    const none = await at("0");
    const twenty = await at("20");
    for (const o of twenty) {
      const same = none.find((n) => n.insurerId === o.insurerId && n.sourceId === o.sourceId)!;
      expect(o.finalCashPrice).toBeLessThan(same.finalCashPrice);
    }
  });

  it("TC4.3 a company at both sellers is one card with its cheapest price", async () => {
    const view = results(await search({ q: "پراید ۹۸ تخفیف ۲۰ درصد" }));
    const asia = view.groups.find((g) => g.insurerId === "asia")!;
    expect(asia.offers.map((o) => o.sourceId).sort()).toEqual(["azki", "bimebazar"]);
    expect(asia.best.finalCashPrice).toBe(Math.min(...asia.offers.map((o) => o.finalCashPrice)));
  });
});

describe("US5: two sorts", () => {
  it("TC5.1 cash is the default", async () => {
    expect(results(await search({ q: "پراید ۹۸ تخفیف ۲۰ درصد" })).sort).toBe("cash");
  });

  it("TC5.2 installment sort: only companies with installments, by total payable", async () => {
    const view = results(await search({ q: "پراید ۹۸ تخفیف ۲۰ درصد", sort: "installment" }));
    expect(view.sort).toBe("installmentTotal");
    const totals = view.groups.map((g) => cheapestInstallmentTotal(g.best.plans));
    expect(totals).not.toContain(null);
    expect(totals).toEqual([...totals].sort((a, b) => a! - b!));
    expect(view.groups.map((g) => g.insurerId)).not.toContain("alborz"); // cash only
    expect(view.groups.map((g) => g.insurerId)).not.toContain("ma"); // cash only
  });
});

describe("US7: picking a company", () => {
  it("TC7.1 shows the stand-in page for that seller", () => {
    expect(selectionMessage(resolveSelection("azki", "asia")!)).toBe("صفحه اینفو «بعد از انتخاب بیمه» در «ازکی»");
    expect(selectionMessage(resolveSelection("bimebazar", "asia")!)).toBe(
      "صفحه اینفو «بعد از انتخاب بیمه» در «بیمه بازار»",
    );
  });

  it("TC7.2 unknown seller is not found", () => {
    expect(resolveSelection("digikala", "asia")).toBeNull();
  });
});

describe("US8: Torob's not-found for unknown vehicles", () => {
  it("TC8.1 پیکان وانت is not in the catalog", async () => {
    expect((await search({ q: "پیکان وانت ۹۸ تخفیف ۲۰" })).kind).toBe("not-found");
  });

  it("TC8.2 text that is not a vehicle", async () => {
    expect((await search({ q: "سلام" })).kind).toBe("not-found");
  });

  it("an unknown model id in the URL is not found", async () => {
    expect((await search({ model: "tesla", year: "1400", discount: "0" })).kind).toBe("not-found");
  });
});

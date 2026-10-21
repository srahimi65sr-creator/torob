// @vitest-environment jsdom
/** UI parts of the scenario tests: what the user sees on a card and in the ask form. */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createSources } from "@/sources";
import { resolveSearch } from "@/services/search";
import { AskForm } from "@/ui/AskForm";
import { InsurerCard } from "@/ui/InsurerCard";

afterEach(cleanup);

const NOW = new Date("2026-10-21T12:00:00Z");
const sellers = createSources().map((s) => ({ sourceId: s.sourceId, name: s.displayName }));

async function asiaCard() {
  const view = await resolveSearch({ q: "پراید ۹۸ تخفیف ۲۰ درصد" }, { sources: createSources(), now: NOW });
  if (view.kind !== "results") throw new Error("expected results");
  const group = view.groups.find((g) => g.insurerId === "asia")!;
  render(<InsurerCard group={group} sort="cash" sellers={sellers} vehicleModelId="pride-131" />);
  return screen.getByTestId("insurer-card");
}

describe("US4 / US6: insurer card", () => {
  it("TC4.3 shows «در ۲ فروشنده» and the cheapest price on the closed card", async () => {
    const card = await asiaCard();
    expect(within(card).getByText("در ۲ فروشنده")).toBeTruthy();
    expect(within(card).getByTestId("headline-price").textContent).toMatch(/^از /);
  });

  it("TC6.1 starts closed; opening shows every seller's breakdown and a select button", async () => {
    const card = await asiaCard();
    const toggle = within(card).getByRole("button");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(within(card).queryByTestId("seller-rows")).toBeNull();

    fireEvent.click(toggle);

    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    const rows = within(card).getByTestId("seller-rows").querySelectorAll("li");
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      const r = within(row as HTMLElement);
      expect(r.getByText("قیمت پایه")).toBeTruthy();
      expect(r.getByText("تخفیف")).toBeTruthy();
      expect(r.getByText("قیمت نهایی نقدی")).toBeTruthy();
      expect(r.getByText("قسطی")).toBeTruthy();
    }
    const select = within(card).getByRole("link", { name: "انتخاب در ازکی" });
    expect(select.getAttribute("href")).toBe("/go/azki?insurer=asia&model=pride-131");
  });
});

describe("US2: ask form", () => {
  it("TC3.1 shows the reason a value was rejected, in Persian digits", async () => {
    const view = await resolveSearch({ q: "پراید ۹۸ تخفیف ۸۰ درصد" }, { sources: createSources(), now: NOW });
    if (view.kind !== "ask") throw new Error("expected ask");
    render(<AskForm known={view.known} ask={view.ask} />);
    expect(screen.getByText("حداکثر ۷۰ درصد")).toBeTruthy();
  });

  it("TC2.1 shows only the missing fields and keeps the model as a hidden field", async () => {
    const view = await resolveSearch({ q: "پراید" }, { sources: createSources(), now: NOW });
    if (view.kind !== "ask") throw new Error("expected ask");
    const { container } = render(<AskForm known={view.known} ask={view.ask} />);
    expect(screen.getAllByRole("combobox").map((s) => s.getAttribute("name"))).toEqual(["year", "discount"]);
    const hidden = [...container.querySelectorAll('input[type="hidden"]')].map((i) => [
      i.getAttribute("name"),
      i.getAttribute("value"),
    ]);
    // Only what is known rides along; an empty field must never be sent as "undefined".
    expect(Object.fromEntries(hidden)).toEqual({ type: "سواری", model: "pride-131" });
    const chips = within(screen.getByRole("list", { name: "مشخصات فهمیده‌شده" })).getAllByRole("listitem");
    expect(chips.map((c) => c.textContent)).toEqual(["پراید ۱۳۱"]);
  });

  it("TC2.1 years are listed without a thousands separator", async () => {
    const view = await resolveSearch({ q: "پراید" }, { sources: createSources(), now: NOW });
    if (view.kind !== "ask") throw new Error("expected ask");
    render(<AskForm known={view.known} ask={view.ask} />);
    const year = screen.getAllByRole("combobox")[0];
    expect(within(year).getByRole("option", { name: "۱۳۹۸" })).toBeTruthy();
  });
});

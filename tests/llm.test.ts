/** The model-backed reader and how search uses it. The model is stubbed: no network, no key. */
import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { createLlmParser, toReading, type LlmParser } from "@/ai/llm-parser";
import { VEHICLES } from "@/catalog/vehicles";
import { DbQuoteStore } from "@/db/quote-store";
import { openDb } from "@/db/client";
import * as t from "@/db/schema";
import { createSources } from "@/sources";
import { resolveSearch, type SearchParams } from "@/services/search";

const NOW = new Date("2026-10-21T12:00:00Z");
const search = (params: SearchParams, llm?: LlmParser) =>
  resolveSearch(params, { sources: createSources(), now: NOW, llm });

/** A stub that answers like the model would and records what it was asked. */
function stub(answer: Awaited<ReturnType<LlmParser>>) {
  return vi.fn<LlmParser>(async () => answer);
}

describe("when the model is asked", () => {
  it("is not asked when the rules read the whole sentence", async () => {
    const llm = stub(null);
    await search({ q: "پراید ۹۸ تخفیف ۲۰ درصد" }, llm);
    expect(llm).not.toHaveBeenCalled();
  });

  it("is asked when words are left unread, e.g. numbers written as words", async () => {
    const llm = stub({ fields: { buildYear: 1398, discountPercent: 20 }, unknownVehicle: false });
    const view = await search({ q: "یه پراید دارم مال سال نود و هشت، چهار سال بدون خسارت" }, llm);
    expect(llm).toHaveBeenCalledOnce();
    expect(view.kind).toBe("results");
    if (view.kind === "results") {
      expect(view.request).toEqual({ vehicleType: "سواری", vehicleModelId: "pride-131", buildYear: 1398, discountPercent: 20 });
    }
  });
});

describe("how the model's reading is used", () => {
  it("fills what the rules missed but never overrides what they found", async () => {
    // Rules read the model as Pride; the stub (wrongly) says Peugeot. Rules win.
    const llm = stub({ fields: { vehicleType: "سواری", vehicleModelId: "peugeot-206-t2", buildYear: 1398 }, unknownVehicle: false });
    const view = await search({ q: "پراید مال سال نود و هشت" }, llm);
    expect(view).toMatchObject({ kind: "ask", known: { vehicleModelId: "pride-131", buildYear: 1398 } });
  });

  it("an unknown vehicle named by the user still gets Torob's not-found", async () => {
    const llm = stub({ fields: { buildYear: 1398 }, unknownVehicle: true });
    expect((await search({ q: "یه پرشیا مدل نود و هشت دارم" }, llm)).kind).toBe("not-found");
  });

  it("text with no vehicle in it asks for the fields instead of failing", async () => {
    const llm = stub({ fields: {}, unknownVehicle: false });
    const view = await search({ q: "سلام، بیمه می‌خوام" }, llm);
    expect(view.kind).toBe("ask");
  });

  it("the model's values go through the same range checks as typed ones", async () => {
    const llm = stub({ fields: { buildYear: 1398, discountPercent: 90 }, unknownVehicle: false });
    const view = await search({ q: "پراید نود و هشت، نود درصد تخفیف دارم" }, llm);
    expect(view).toMatchObject({ kind: "ask", ask: [{ field: "discountPercent", error: "حداکثر 70 درصد" }] });
  });

  it("if the model gives no reading, the rules' reading is used", async () => {
    expect((await search({ q: "پیکان وانت ۹۸" }, stub(null))).kind).toBe("not-found");
  });

  it("the search log records which reader understood the sentence", async () => {
    const db = await openDb();
    const store = new DbQuoteStore(db);
    const llm = stub({ fields: { buildYear: 1398, discountPercent: 20 }, unknownVehicle: false });
    await resolveSearch({ q: "پراید ۹۸ تخفیف ۲۰ درصد" }, { sources: createSources(), store, llm });
    await resolveSearch({ q: "یه پراید مال نود و هشت با چهار سال تخفیف" }, { sources: createSources(), store, llm });
    const logs = await db.select().from(t.searchLogs).orderBy(t.searchLogs.id);
    expect(logs.map((l) => (l.parsedRequest as { parsedBy: string }).parsedBy)).toEqual(["rules", "llm"]);
    await db.$client.close();
  });
});

describe("toReading", () => {
  it("maps a catalog id to the vehicle and its type", () => {
    expect(toReading({ vehicleModelId: "pride-131", buildYear: 1398, discountPercent: null }, VEHICLES)).toEqual({
      fields: { vehicleModelId: "pride-131", vehicleType: "سواری", buildYear: 1398 },
      unknownVehicle: false,
    });
  });

  it("does not trust an id outside the catalog", () => {
    expect(toReading({ vehicleModelId: "tesla", buildYear: null, discountPercent: null }, VEHICLES).fields).toEqual({});
  });
});

describe("createLlmParser", () => {
  const fakeClient = (impl: () => Promise<unknown>) =>
    ({ beta: { messages: { parse: vi.fn(impl) } } }) as unknown as Anthropic;

  it("asks Claude with structured output and server-side fallbacks, and reads the parsed answer", async () => {
    const client = fakeClient(async () => ({
      stop_reason: "end_turn",
      parsed_output: { vehicleModelId: "peugeot-206-t2", buildYear: 1400, discountPercent: 35 },
    }));
    const reading = await createLlmParser(client)("پژو دویست و شش مدل ۱۴۰۰ با هفت سال بدون خسارت", VEHICLES);
    expect(reading?.fields).toMatchObject({ vehicleModelId: "peugeot-206-t2", buildYear: 1400, discountPercent: 35 });

    const request = (client.beta.messages.parse as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(request.model).toBe("claude-opus-5-5");
    expect(request.fallbacks).toBe("default");
    expect(request.betas).toEqual(["server-side-fallback-2026-07-01"]);
    expect(request.output_config.effort).toBe("low");
    expect(request.output_config.format).toBeDefined();
  });

  it("gives no reading when the model declines", async () => {
    const client = fakeClient(async () => ({ stop_reason: "refusal", parsed_output: null }));
    expect(await createLlmParser(client)("...", VEHICLES)).toBeNull();
  });

  it("gives no reading when the API fails, so search keeps working", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const client = fakeClient(async () => {
      throw new Error("network down");
    });
    expect(await createLlmParser(client)("...", VEHICLES)).toBeNull();
    warn.mockRestore();
  });
});

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { CatalogVehicle } from "@/catalog/vehicles";
import { MAX_DISCOUNT_PERCENT, type QuoteRequest } from "@/domain/quote-request";

export const LLM_MODEL = "claude-opus-5-5";

/** What the model may answer. Ranges are checked later, like any other input. */
function answerSchema(catalog: CatalogVehicle[]) {
  return z.object({
    vehicleModelId: z.enum(["unknown", "none", ...catalog.map((v) => v.id)]),
    buildYear: z.number().int().nullable(),
    discountPercent: z.number().int().nullable(),
  });
}

export interface LlmReading {
  fields: Partial<QuoteRequest>;
  /** The user named a vehicle that is not in the catalog. */
  unknownVehicle: boolean;
}

/** Reads a sentence the rules could not fully understand. Null means "no reading": fall back to the rules. */
export type LlmParser = (text: string, catalog: CatalogVehicle[]) => Promise<LlmReading | null>;

function systemPrompt(catalog: CatalogVehicle[]): string {
  const vehicles = catalog
    .map((v) => `- ${v.id}: ${v.brand} ${v.model} (${v.vehicleType}); also written as ${v.aliases.join("، ")}`)
    .join("\n");
  return [
    "You read one Persian sentence in which a user describes their car to get a third-party car insurance quote.",
    "Extract the vehicle, its build year and the user's no-claim discount. Never guess what the sentence does not say.",
    "",
    "Vehicles we have data for:",
    vehicles,
    "",
    "vehicleModelId: one of the ids above; \"unknown\" if the user names a vehicle that is not in this list; \"none\" if no vehicle is named.",
    "buildYear: the Solar Hijri (Shamsi) year. Two-digit years like ۹۸ or «نود و هشت» mean 1398; ۰۲ means 1402. Convert a Gregorian year by subtracting 621. Null if not given.",
    `discountPercent: the no-claim discount in percent. Each claim-free year is 5%, capped at ${MAX_DISCOUNT_PERCENT}% («چهار سال بدون خسارت» is 20). «بدون تخفیف» is 0. Null if not given.`,
    "Numbers may be written in words, in Persian digits or in Latin digits.",
  ].join("\n");
}

/**
 * Claude-backed reader, called only for sentences the rules leave partly unread.
 * Server-side fallbacks are on: if the model declines, the API retries on a fallback model in the same call.
 */
export function createLlmParser(client: Anthropic = new Anthropic()): LlmParser {
  return async (text, catalog) => {
    const schema = answerSchema(catalog);
    try {
      const response = await client.beta.messages.parse({
        model: LLM_MODEL,
        max_tokens: 4000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: systemPrompt(catalog),
        messages: [{ role: "user", content: text }],
        output_config: { effort: "low", format: betaZodOutputFormat(schema) },
      });
      if (response.stop_reason === "refusal" || !response.parsed_output) return null;
      return toReading(response.parsed_output, catalog);
    } catch (error) {
      // The search still works without the model: the rules' reading is used and the form asks the rest.
      if (error instanceof Anthropic.APIError) {
        console.warn(`LLM parser unavailable (${error.status ?? "no status"}): ${error.message}`);
      } else {
        console.warn("LLM parser failed:", error);
      }
      return null;
    }
  };
}

/** Turns the model's answer into fields; a vehicle id outside the catalog is rejected, not trusted. */
export function toReading(
  answer: { vehicleModelId: string; buildYear: number | null; discountPercent: number | null },
  catalog: CatalogVehicle[],
): LlmReading {
  const fields: Partial<QuoteRequest> = {};
  const vehicle = catalog.find((v) => v.id === answer.vehicleModelId);
  if (vehicle) {
    fields.vehicleModelId = vehicle.id;
    fields.vehicleType = vehicle.vehicleType;
  }
  if (answer.buildYear !== null) fields.buildYear = answer.buildYear;
  if (answer.discountPercent !== null) fields.discountPercent = answer.discountPercent;
  return { fields, unknownVehicle: answer.vehicleModelId === "unknown" };
}

/** The app turns the model on only when credentials are configured, so a fresh checkout runs without a key. */
export function llmParserFromEnv(): LlmParser | undefined {
  return process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN ? createLlmParser() : undefined;
}

import type { CatalogVehicle } from "@/catalog/vehicles";
import { DISCOUNT_PER_YEAR, MAX_DISCOUNT_PERCENT, type QuoteRequest } from "@/domain/quote-request";
import { normalizePersian } from "@/normalize/text";

export interface ParsedQuery {
  fields: Partial<QuoteRequest>;
  /** Words left after taking out everything recognized. Non-empty means the user named something we don't know. */
  leftover: string;
}

/** Words that carry no vehicle information. */
const FILLER = new Set([
  "با", "و", "به", "از", "برای", "مدل", "سال", "ساخت", "تخفیف", "درصد", "بیمه", "ثالث", "شخص",
  "ماشین", "خودرو", "خودروی", "دارم", "میخوام", "می", "خوام", "خواهم", "قیمت", "استعلام", "یه", "یک",
]);

/** Plain-language types people write, mapped to the catalog's vehicle type. */
const TYPE_WORDS: Record<string, string> = { "سواری": "سواری" };

function take(text: string, pattern: RegExp): { match: RegExpMatchArray | null; rest: string } {
  const match = text.match(pattern);
  return { match, rest: match ? text.replace(match[0], " ") : text };
}

function twoDigitYear(yy: number): number {
  // "۹۵" is 1395, "۰۲" is 1402.
  return yy >= 50 ? 1300 + yy : 1400 + yy;
}

/**
 * Turns "پراید ۹۸ با ۲۰ درصد تخفیف" into fields. Rule-based so it is fast, free and testable;
 * values are not range-checked here, the search step decides what to ask again.
 */
export function parseQuery(input: string, catalog: CatalogVehicle[]): ParsedQuery {
  let text = ` ${normalizePersian(input).replace(/[،,.!؟?:;()]/g, " ")} `;
  const fields: Partial<QuoteRequest> = {};

  // Model first, longest alias first, so "پژو 206 تیپ 2" is not read as a year or a discount.
  const aliases = catalog
    .flatMap((v) => v.aliases.map((a) => ({ vehicle: v, alias: normalizePersian(a) })))
    .sort((a, b) => b.alias.length - a.alias.length);
  for (const { vehicle, alias } of aliases) {
    const at = text.indexOf(` ${alias} `);
    if (at >= 0) {
      fields.vehicleModelId = vehicle.id;
      fields.vehicleType = vehicle.vehicleType;
      text = text.slice(0, at) + " " + text.slice(at + alias.length + 2) + " ";
      break;
    }
  }

  for (const [word, type] of Object.entries(TYPE_WORDS)) {
    if (text.includes(` ${word} `)) {
      fields.vehicleType ??= type;
      text = text.replace(` ${word} `, " ");
    }
  }

  // Discount: "بدون تخفیف", "۴ سال تخفیف", "۲۰ درصد", "۲۰٪", "تخفیف ۲۰".
  let found = take(text, /بدون\s+تخفیف/);
  if (found.match) {
    fields.discountPercent = 0;
  } else {
    found = take(text, /(\d{1,2})\s*سال\s*(?:عدم\s*خسارت\s*|تخفیف)/);
    if (found.match) {
      fields.discountPercent = Math.min(Number(found.match[1]) * DISCOUNT_PER_YEAR, MAX_DISCOUNT_PERCENT);
    } else {
      found = take(text, /(\d{1,3})\s*(?:درصد|%|٪)/);
      if (!found.match) found = take(text, /تخفیف\s*(\d{1,3})(?!\d)/);
      if (found.match) fields.discountPercent = Number(found.match[1]);
    }
  }
  text = found.rest;

  // Build year: "مدل ۹۸", "سال ۱۴۰۰", or a bare "۱۳۹۹" / "۹۵".
  found = take(text, /(?:مدل|سال|ساخت)\s*(\d{2}|\d{4})(?!\d)/);
  if (!found.match) found = take(text, /(?<!\d)(1[34]\d\d)(?!\d)/);
  if (!found.match) found = take(text, /(?<!\d)(\d{2})(?!\d)/);
  if (found.match) {
    const n = Number(found.match[1]);
    fields.buildYear = n < 100 ? twoDigitYear(n) : n;
  }
  text = found.rest;

  const leftover = text
    .split(/\s+/)
    .filter((w) => w && !FILLER.has(w))
    .join(" ");

  return { fields, leftover };
}

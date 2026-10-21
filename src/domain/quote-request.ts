/** What the user is asking a price for. All years are Shamsi (Solar Hijri). */
export interface QuoteRequest {
  vehicleType: string;
  vehicleModelId: string;
  buildYear: number;
  discountPercent: number;
}

export type QuoteField = keyof QuoteRequest;

/** In the order the user is asked for them. */
export const QUOTE_FIELDS: QuoteField[] = ["vehicleType", "vehicleModelId", "buildYear", "discountPercent"];

export const FIELD_LABELS: Record<QuoteField, string> = {
  vehicleType: "نوع خودرو",
  vehicleModelId: "مدل",
  buildYear: "سال ساخت",
  discountPercent: "درصد تخفیف",
};

export const MIN_BUILD_YEAR = 1370;
export const MAX_DISCOUNT_PERCENT = 70;
export const DISCOUNT_STEP = 5;
/** Third-party no-claim discount grows 5% for each year without a claim. */
export const DISCOUNT_PER_YEAR = 5;

export function currentShamsiYear(now: Date = new Date()): number {
  const year = new Intl.DateTimeFormat("en-US-u-ca-persian", { year: "numeric" }).format(now);
  return Number.parseInt(year, 10);
}

/** Returns why a value is not accepted, or null when it is fine. */
export function buildYearError(year: number, now?: Date): string | null {
  const max = currentShamsiYear(now);
  if (!Number.isInteger(year) || year < MIN_BUILD_YEAR || year > max) {
    return `سال ساخت باید بین ${MIN_BUILD_YEAR} تا ${max} باشه`;
  }
  return null;
}

export function discountError(percent: number): string | null {
  if (!Number.isInteger(percent) || percent < 0 || percent > MAX_DISCOUNT_PERCENT) {
    return `حداکثر ${MAX_DISCOUNT_PERCENT} درصد`;
  }
  if (percent % DISCOUNT_STEP !== 0) {
    return `درصد تخفیف باید ضریب ${DISCOUNT_STEP} باشه`;
  }
  return null;
}

/** Stable string for caching: same request, same key. */
export function requestKey(request: QuoteRequest): string {
  return QUOTE_FIELDS.map((k) => `${k}=${request[k]}`).join("&");
}

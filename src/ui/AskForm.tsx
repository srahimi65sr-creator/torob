import { VEHICLES, VEHICLE_TYPES, findVehicle } from "@/catalog/vehicles";
import {
  DISCOUNT_STEP,
  FIELD_LABELS,
  MAX_DISCOUNT_PERCENT,
  MIN_BUILD_YEAR,
  currentShamsiYear,
  type QuoteField,
  type QuoteRequest,
} from "@/domain/quote-request";
import { faDigits, faNumber, faText } from "./format";

const PARAM: Record<QuoteField, string> = {
  vehicleType: "type",
  vehicleModelId: "model",
  buildYear: "year",
  discountPercent: "discount",
};

function knownLabel(field: QuoteField, value: string | number): string {
  if (field === "vehicleModelId") return findVehicle(String(value))?.model ?? String(value);
  if (field === "discountPercent") return `${faNumber(Number(value))}٪ تخفیف`;
  if (field === "buildYear") return `مدل ${faDigits(Number(value))}`;
  return String(value);
}

function options(field: QuoteField, known: Partial<QuoteRequest>): { value: string; label: string }[] {
  switch (field) {
    case "vehicleType":
      return VEHICLE_TYPES.map((t) => ({ value: t, label: t }));
    case "vehicleModelId":
      return VEHICLES.filter((v) => !known.vehicleType || v.vehicleType === known.vehicleType).map((v) => ({
        value: v.id,
        label: v.model,
      }));
    case "buildYear": {
      const years = [];
      for (let y = currentShamsiYear(); y >= MIN_BUILD_YEAR; y--) years.push({ value: String(y), label: faDigits(y) });
      return years;
    }
    case "discountPercent": {
      const steps = [];
      for (let p = 0; p <= MAX_DISCOUNT_PERCENT; p += DISCOUNT_STEP) steps.push({ value: String(p), label: `${faNumber(p)}٪` });
      return steps;
    }
  }
}

/** Asks only what is missing; what the user already said rides along as hidden fields. */
export function AskForm({
  known,
  ask,
}: {
  known: Partial<QuoteRequest>;
  ask: { field: QuoteField; error: string | null }[];
}) {
  const entries = (Object.entries(known) as [QuoteField, string | number | undefined][]).filter(
    (e): e is [QuoteField, string | number] => e[1] !== undefined,
  );
  // The model already says the type, so its chip would repeat.
  const chips = entries.filter(([f]) => !(f === "vehicleType" && known.vehicleModelId));
  return (
    <form action="/search" className="rounded-lg bg-white p-5" data-testid="ask-form">
      <h1 className="text-lg font-bold text-slate-800">چند تا مشخصه‌ی دیگه لازمه</h1>
      {chips.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="مشخصات فهمیده‌شده">
          {chips.map(([field, value]) => (
            <li key={field} className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-800">
              {knownLabel(field, value)}
            </li>
          ))}
        </ul>
      )}
      {entries.map(([field, value]) => (
        <input key={field} type="hidden" name={PARAM[field]} value={String(value)} />
      ))}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {ask.map(({ field, error }) => (
          <label key={field} className="flex flex-col gap-1 text-sm text-slate-800">
            {FIELD_LABELS[field]}
            <select
              name={PARAM[field]}
              required
              defaultValue=""
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
              aria-invalid={error ? true : undefined}
            >
              <option value="" disabled>
                انتخاب کن
              </option>
              {options(field, known).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {error && <span className="text-xs text-torob">{faText(error)}</span>}
          </label>
        ))}
      </div>
      <button type="submit" className="mt-5 rounded-lg bg-slate-800 px-5 py-2 text-sm font-bold text-slate-50">
        نمایش قیمت‌ها
      </button>
    </form>
  );
}

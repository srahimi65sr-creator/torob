const ARABIC_TO_PERSIAN: Record<string, string> = { "ي": "ی", "ى": "ی", "ك": "ک", "ة": "ه" };
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** Makes Persian text from different sources comparable: letters, digits, spaces. */
export function normalizePersian(input: string): string {
  return input
    .replace(/[يىكة]/g, (ch) => ARABIC_TO_PERSIAN[ch])
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))
    .replace(/‌/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

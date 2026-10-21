const toman = new Intl.NumberFormat("fa-IR");
const plain = new Intl.NumberFormat("fa-IR", { useGrouping: false });

/** 8944000 → "۸٬۹۴۴٬۰۰۰". */
export function faNumber(n: number): string {
  return toman.format(n);
}

/** For years and ids, where a thousands separator is wrong: 1398 → "۱۳۹۸". */
export function faDigits(n: number): string {
  return plain.format(n);
}

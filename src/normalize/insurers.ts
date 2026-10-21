import { normalizePersian } from "./text";

export interface Insurer {
  id: string;
  name: string;
}

/** Canonical insurers. Each source's spelling is mapped to one of these. */
export const INSURERS: Insurer[] = [
  { id: "iran", name: "بیمه ایران" },
  { id: "asia", name: "بیمه آسیا" },
  { id: "alborz", name: "بیمه البرز" },
  { id: "dana", name: "بیمه دانا" },
  { id: "parsian", name: "بیمه پارسیان" },
  { id: "saman", name: "بیمه سامان" },
  { id: "ma", name: "بیمه ما" },
  { id: "dey", name: "بیمه دی" },
  { id: "moallem", name: "بیمه معلم" },
  { id: "razi", name: "بیمه رازی" },
  { id: "kowsar", name: "بیمه کوثر" },
  { id: "mellat", name: "بیمه ملت" },
  { id: "novin", name: "بیمه نوین" },
  { id: "pasargad", name: "بیمه پاسارگاد" },
  { id: "sina", name: "بیمه سینا" },
  { id: "taavon", name: "بیمه تعاون" },
  { id: "sarmad", name: "بیمه سرمد" },
  { id: "hafez", name: "بیمه حافظ" },
  { id: "karafarin", name: "بیمه کارآفرین" },
  { id: "hekmat", name: "بیمه حکمت" },
  { id: "tejarat-no", name: "بیمه تجارت نو" },
];

/** "بیمه ایران", "ايران" and "ایران" all become "ایران". "بیمه ما" stays "ما". */
function insurerKey(name: string): string {
  return normalizePersian(name).replace(/^بیمه\s+/, "");
}

const BY_KEY = new Map(INSURERS.map((i) => [insurerKey(i.name), i]));

/** Returns null for an unknown name, so a new insurer is noticed instead of silently guessed. */
export function resolveInsurer(rawName: string): Insurer | null {
  return BY_KEY.get(insurerKey(rawName)) ?? null;
}

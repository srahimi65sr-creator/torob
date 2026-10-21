import { sourceName } from "@/sources";

export interface Selection {
  sourceId: string;
  sourceName: string;
  insurerId: string | null;
}

/** Null when the seller is unknown, so the page shows Torob's "not found". */
export function resolveSelection(sourceId: string, insurerId?: string): Selection | null {
  const name = sourceName(sourceId);
  if (!name) return null;
  return { sourceId, sourceName: name, insurerId: insurerId ?? null };
}

/** The text on the stand-in page that replaces the seller's own page in the demo. */
export function selectionMessage(selection: Selection): string {
  return `صفحه اینفو «بعد از انتخاب بیمه» در «${selection.sourceName}»`;
}

/**
 * One outbound click to a seller. Torob's existing seller panel reads these for traffic reports
 * and billing; in the demo it is only logged.
 */
export function recordClick(selection: Selection, vehicleModelId?: string): void {
  console.info(
    JSON.stringify({ event: "seller_click", ...selection, vehicleModelId: vehicleModelId ?? null, at: new Date().toISOString() }),
  );
}

import type { InsurerId, Offer, SourceId } from "./offer";
import { cheapestInstallmentTotal } from "./payment-plan";

export type SortKey = "cash" | "installmentTotal";

export interface CompareOptions {
  sort: SortKey;
  onlyInstallment?: boolean;
  insurerIds?: InsurerId[];
  sourceIds?: SourceId[];
}

/** One row on the results page: an insurer, like a product with several stores on Torob. */
export interface InsurerGroup {
  insurerId: InsurerId;
  insurerName: string;
  best: Offer;
  offers: Offer[];
}

function priceFor(offer: Offer, sort: SortKey): number | null {
  return sort === "cash" ? offer.finalCashPrice : cheapestInstallmentTotal(offer.plans);
}

export function compareOffers(offers: Offer[], options: CompareOptions): InsurerGroup[] {
  // Sorting by installment total only makes sense for offers that have one.
  const needsInstallment = options.onlyInstallment || options.sort === "installmentTotal";

  const kept = offers.filter(
    (o) =>
      (!options.insurerIds?.length || options.insurerIds.includes(o.insurerId)) &&
      (!options.sourceIds?.length || options.sourceIds.includes(o.sourceId)) &&
      (!needsInstallment || cheapestInstallmentTotal(o.plans) !== null),
  );

  const byInsurer = new Map<InsurerId, Offer[]>();
  for (const offer of kept) {
    byInsurer.set(offer.insurerId, [...(byInsurer.get(offer.insurerId) ?? []), offer]);
  }

  const price = (o: Offer) => priceFor(o, options.sort) ?? Number.POSITIVE_INFINITY;

  return [...byInsurer.values()]
    .map((group) => {
      const sorted = [...group].sort((a, b) => price(a) - price(b));
      return {
        insurerId: sorted[0].insurerId,
        insurerName: sorted[0].insurerName,
        best: sorted[0],
        offers: sorted,
      };
    })
    .sort(
      (a, b) =>
        price(a.best) - price(b.best) || a.insurerName.localeCompare(b.insurerName, "fa"),
    );
}

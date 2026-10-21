"use client";

import { useId, useState } from "react";
import type { InsurerGroup, SortKey } from "@/domain/compare";
import { cheapestInstallmentTotal, installmentPlans } from "@/domain/payment-plan";
import { faNumber } from "./format";

export interface SellerInfo {
  sourceId: string;
  name: string;
}

function selectHref(sourceId: string, insurerId: string, vehicleModelId: string) {
  const params = new URLSearchParams({ insurer: insurerId, model: vehicleModelId });
  return `/go/${sourceId}?${params}`;
}

/** One insurer. Closed: best price and seller count. Open: every seller's full price breakdown. */
export function InsurerCard({
  group,
  sort,
  sellers,
  vehicleModelId,
}: {
  group: InsurerGroup;
  sort: SortKey;
  sellers: SellerInfo[];
  vehicleModelId: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const nameOf = (id: string) => sellers.find((s) => s.sourceId === id)?.name ?? id;
  const headline =
    sort === "cash" ? group.best.finalCashPrice : (cheapestInstallmentTotal(group.best.plans) ?? group.best.finalCashPrice);

  return (
    <article className="rounded-lg bg-white" data-testid="insurer-card" data-insurer={group.insurerId}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-4 p-4 text-right"
      >
        <span>
          <span className="block font-bold text-slate-800">{group.insurerName}</span>
          <span className="block text-xs text-slate-500">
            {group.offers.length > 1 ? `در ${faNumber(group.offers.length)} فروشنده` : `در ${nameOf(group.best.sourceId)}`}
          </span>
        </span>
        <span className="text-left">
          <span className="block text-sm font-bold text-slate-800" data-testid="headline-price">
            {group.offers.length > 1 ? "از " : ""}
            {faNumber(headline)} تومان
          </span>
          <span className="block text-xs text-slate-500">{sort === "cash" ? "نقدی با تخفیف" : "جمع کل قسطی"}</span>
        </span>
      </button>

      {open && (
        <ul id={panelId} className="border-t border-slate-100 px-4 pb-2" data-testid="seller-rows">
          {group.offers.map((offer) => {
            const installment = installmentPlans(offer.plans)[0];
            return (
              <li key={offer.sourceId} className="flex flex-wrap items-center justify-between gap-3 py-3" data-seller={offer.sourceId}>
                <div className="text-sm text-slate-800">
                  <div className="font-bold">{nameOf(offer.sourceId)}</div>
                  <dl className="mt-1 grid grid-cols-[auto_auto] gap-x-3 text-xs text-slate-500">
                    <dt>قیمت پایه</dt>
                    <dd>{faNumber(offer.basePrice)} تومان</dd>
                    <dt>تخفیف</dt>
                    <dd>{faNumber(offer.discountAmount)} تومان</dd>
                    <dt>قیمت نهایی نقدی</dt>
                    <dd className="font-bold text-slate-800">{faNumber(offer.finalCashPrice)} تومان</dd>
                    <dt>قسطی</dt>
                    <dd>
                      {installment
                        ? `${faNumber(installment.months)} قسط ${faNumber(installment.installmentAmount)}، پیش‌پرداخت ${faNumber(installment.downPayment)}، جمع ${faNumber(installment.totalPayable)} تومان`
                        : "ندارد"}
                    </dd>
                  </dl>
                </div>
                <a
                  href={selectHref(offer.sourceId, offer.insurerId, vehicleModelId)}
                  className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-slate-50"
                >
                  انتخاب در {nameOf(offer.sourceId)}
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}

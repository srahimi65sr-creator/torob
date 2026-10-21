import Link from "next/link";
import { findVehicle } from "@/catalog/vehicles";
import type { InsurerGroup, SortKey } from "@/domain/compare";
import type { QuoteRequest } from "@/domain/quote-request";
import { faDigits, faNumber } from "./format";
import { InsurerCard, type SellerInfo } from "./InsurerCard";

function hrefWith(request: QuoteRequest, sort: SortKey) {
  const params = new URLSearchParams({
    type: request.vehicleType,
    model: request.vehicleModelId,
    year: String(request.buildYear),
    discount: String(request.discountPercent),
    sort: sort === "cash" ? "cash" : "installment",
  });
  return `/search?${params}`;
}

const SORTS: { key: SortKey; label: string }[] = [
  { key: "cash", label: "ارزان‌ترین نقدی" },
  { key: "installmentTotal", label: "ارزان‌ترین قسطی" },
];

export function Results({
  request,
  sort,
  groups,
  sellers,
  failedSources,
}: {
  request: QuoteRequest;
  sort: SortKey;
  groups: InsurerGroup[];
  sellers: SellerInfo[];
  failedSources: string[];
}) {
  const vehicle = findVehicle(request.vehicleModelId);
  return (
    <section>
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-800">
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1">{vehicle?.model}</span>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1">مدل {faDigits(request.buildYear)}</span>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
          {faNumber(request.discountPercent)}٪ تخفیف
        </span>
        <Link href="/" className="text-blue-500">
          ویرایش
        </Link>
      </div>

      <nav className="mt-4 flex items-center gap-4 text-sm" aria-label="مرتب‌سازی">
        <span className="text-slate-500">مرتب‌سازی:</span>
        {SORTS.map((s) => (
          <Link
            key={s.key}
            href={hrefWith(request, s.key)}
            aria-current={s.key === sort ? "true" : undefined}
            className={s.key === sort ? "font-bold text-torob" : "text-slate-800"}
          >
            {s.label}
          </Link>
        ))}
      </nav>

      {failedSources.length > 0 && (
        <p className="mt-3 text-xs text-slate-500">قیمت‌های {failedSources.join("، ")} الان در دسترس نیست.</p>
      )}

      <div className="mt-4 flex flex-col gap-3" data-testid="results">
        {groups.map((g) => (
          <InsurerCard key={g.insurerId} group={g} sort={sort} sellers={sellers} vehicleModelId={request.vehicleModelId} />
        ))}
      </div>
      <p className="mt-4 text-xs text-slate-500">قیمت‌ها نمونه‌ان و برای دمو ساخته شدن.</p>
    </section>
  );
}

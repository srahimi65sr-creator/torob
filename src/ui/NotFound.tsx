import Link from "next/link";

/** Torob's own 404 page: same words and layout. */
export function NotFound() {
  return (
    <section className="flex flex-col items-center py-16 text-center" data-testid="not-found">
      <svg viewBox="0 0 120 120" className="h-40 w-40 text-slate-300" aria-hidden="true">
        <circle cx="60" cy="60" r="50" fill="none" stroke="currentColor" strokeWidth="14" />
        <circle cx="45" cy="50" r="6" fill="currentColor" />
        <circle cx="75" cy="50" r="6" fill="currentColor" />
        <path d="M40 82 Q60 64 80 82 Z" fill="currentColor" />
      </svg>
      <h1 className="mt-6 text-xl font-bold text-slate-800">صفحه یافت نشد - خطای ۴۰۴</h1>
      <p className="mt-8 text-sm text-slate-800">
        می توانید برای دیدن صفحات بیشتر از طریق منو یا جستجوی جدید اقدام کنید.
      </p>
      <Link href="/" className="mt-2 text-sm text-blue-500">
        جستجوی جدید
      </Link>
    </section>
  );
}

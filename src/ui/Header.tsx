import Link from "next/link";

export function Header({ query = "" }: { query?: string }) {
  return (
    <header className="bg-white border-b border-slate-200">
      <div className="mx-auto max-w-5xl flex items-center gap-4 px-4 py-3">
        <Link href="/" className="text-xl font-bold text-torob shrink-0">
          ترب <span className="text-slate-800">بیمه</span>
        </Link>
        <form action="/search" className="flex flex-1 max-w-xl">
          <input
            name="q"
            defaultValue={query}
            placeholder="مثلاً: پراید ۹۸ با ۲۰ درصد تخفیف"
            aria-label="جست‌وجوی خودرو"
            className="flex-1 rounded-r-lg border border-slate-200 bg-slate-50 px-3 py-2 text-base outline-none focus:border-slate-400"
          />
          <button type="submit" className="rounded-l-lg bg-torob px-4 text-white" aria-label="جست‌وجو">
            جست‌وجو
          </button>
        </form>
      </div>
    </header>
  );
}

import { Header } from "@/ui/Header";

export default function Home() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-800">قیمت بیمه‌ی شخص ثالث از همه‌ی فروشنده‌ها</h1>
        <p className="mt-3 text-slate-500">مشخصات خودروت رو همون‌طور که به یه دوست می‌گی بنویس.</p>
        <form action="/search" className="mt-8 flex">
          <input
            name="q"
            autoFocus
            placeholder="مثلاً: پراید ۱۳۱ مدل ۹۸ با ۲۰ درصد تخفیف"
            aria-label="مشخصات خودرو"
            className="flex-1 rounded-r-lg border border-slate-200 bg-slate-50 px-4 py-3 text-base outline-none focus:border-slate-400"
          />
          <button type="submit" className="rounded-l-lg bg-torob px-6 font-bold text-white">
            استعلام
          </button>
        </form>
      </main>
    </>
  );
}

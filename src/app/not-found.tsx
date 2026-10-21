import { Header } from "@/ui/Header";
import { NotFound } from "@/ui/NotFound";

export default function NotFoundPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <NotFound />
      </main>
    </>
  );
}

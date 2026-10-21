import { getDb } from "@/db/client";
import { DbQuoteStore } from "@/db/quote-store";
import { createSources } from "@/sources";
import { resolveSearch, type SearchParams } from "@/services/search";
import { AskForm } from "@/ui/AskForm";
import { Header } from "@/ui/Header";
import { NotFound } from "@/ui/NotFound";
import { Results } from "@/ui/Results";

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const raw = await searchParams;
  const params: SearchParams = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  );
  const sources = createSources();
  const store = new DbQuoteStore(await getDb());
  const view = await resolveSearch(params, { sources, store });

  return (
    <>
      <Header query={params.q} />
      <main className="mx-auto max-w-3xl px-4 py-6">
        {view.kind === "not-found" && <NotFound />}
        {view.kind === "ask" && <AskForm known={view.known} ask={view.ask} />}
        {view.kind === "results" && (
          <Results
            request={view.request}
            sort={view.sort}
            groups={view.groups}
            sellers={sources.map((s) => ({ sourceId: s.sourceId, name: s.displayName }))}
            failedSources={view.failedSources}
          />
        )}
      </main>
    </>
  );
}

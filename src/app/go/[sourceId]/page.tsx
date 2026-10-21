import { notFound } from "next/navigation";
import { recordClick, resolveSelection, selectionMessage } from "@/services/selection";

/** Stands in for the seller's own page after the user picks an insurer. */
export default async function SelectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ sourceId: string }>;
  searchParams: Promise<{ insurer?: string; model?: string }>;
}) {
  const { sourceId } = await params;
  const { insurer, model } = await searchParams;
  const selection = resolveSelection(sourceId, insurer);
  if (!selection) notFound();
  recordClick(selection, model);

  return (
    <main className="fixed inset-0 flex items-center justify-center bg-white p-6 text-center">
      <p className="text-lg text-slate-800" data-testid="selection-message">
        {selectionMessage(selection)}
      </p>
    </main>
  );
}

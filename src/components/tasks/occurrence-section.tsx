import Link from "next/link";
import { PageState } from "@/components/ui/page-state";
import { OccurrenceItem } from "./occurrence-item";
import type { OccurrenceDto } from "./types";

type OccurrenceSectionProps = {
  title: string;
  emptyMessage: string;
  occurrences: OccurrenceDto[];
  loading: boolean;
  error: string | null;
  actionLoadingId?: string | null;
  onComplete: (id: string) => Promise<void>;
  onIgnore: (id: string) => Promise<void>;
  onOpen?: (id: string) => void;
  onViewTask?: (taskCode: number) => void;
  viewAllHref?: string;
};

export function OccurrenceSection({
  title,
  emptyMessage,
  occurrences,
  loading,
  error,
  actionLoadingId,
  onComplete,
  onIgnore,
  onOpen,
  onViewTask,
  viewAllHref,
}: OccurrenceSectionProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
        {viewAllHref ? (
          <Link className="text-sm font-medium text-slate-700 underline hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100" href={viewAllHref}>
            Ver todas
          </Link>
        ) : null}
      </div>
      {loading ? <PageState description="Buscando ocorrencias..." title="Carregando" /> : null}
      {!loading && error ? <PageState description={error} title="Erro" /> : null}
      {!loading && !error && occurrences.length === 0 ? <PageState description={emptyMessage} title="Vazio" /> : null}
      {!loading && !error && occurrences.length > 0
        ? occurrences.map((occurrence) => (
            <OccurrenceItem
              key={occurrence.id}
              loadingActionId={actionLoadingId}
              occurrence={occurrence}
              onComplete={onComplete}
              onIgnore={onIgnore}
              onOpen={onOpen}
              onViewTask={onViewTask}
            />
          ))
        : null}
    </section>
  );
}

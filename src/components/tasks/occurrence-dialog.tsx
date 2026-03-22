"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { PageState } from "@/components/ui/page-state";
import { apiRequest } from "@/lib/http-client";
import { formatDateTime, occurrenceActionLabel, occurrenceStatusWithDateLabel, recurrenceLabel, taskStatusWithDateLabel } from "./format";
import type { OccurrenceDetailsDto } from "./types";

const HISTORY_PAGE_SIZE = 5;

type OccurrenceDialogProps = {
  open: boolean;
  occurrenceId?: string | null;
  userId: string;
  initialOccurrence?: OccurrenceDetailsDto | null;
  isMockMode?: boolean;
  loadingActionId?: string | null;
  onClose: () => void;
  onComplete?: (id: string) => Promise<void>;
  onIgnore?: (id: string) => Promise<void>;
};

export function OccurrenceDialog({
  open,
  occurrenceId,
  userId,
  initialOccurrence,
  isMockMode = false,
  loadingActionId,
  onClose,
  onComplete,
  onIgnore,
}: OccurrenceDialogProps) {
  const [occurrence, setOccurrence] = useState<OccurrenceDetailsDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyPage, setHistoryPage] = useState(1);

  useEffect(() => {
    if (!open || !occurrenceId) {
      setOccurrence(null);
      setError(null);
      setHistoryPage(1);
      return;
    }

    if (isMockMode) {
      setOccurrence(initialOccurrence ?? null);
      setError(initialOccurrence ? null : "Recorrencia simulada nao encontrada.");
      setHistoryPage(1);
      return;
    }

    void (async () => {
      setLoading(true);
      setError(null);
      setHistoryPage(1);
      try {
        const data = await apiRequest<OccurrenceDetailsDto>(`/api/occurrences/${occurrenceId}?userId=${encodeURIComponent(userId)}`);
        setOccurrence(data);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Falha ao carregar recorrencia.");
      } finally {
        setLoading(false);
      }
    })();
  }, [initialOccurrence, isMockMode, occurrenceId, open, userId]);

  async function handleOccurrenceAction(action: "complete" | "ignore") {
    if (!occurrence) {
      return;
    }

    try {
      if (action === "complete") {
        await onComplete?.(occurrence.id);
      } else {
        await onIgnore?.(occurrence.id);
      }

      onClose();
    } catch {
      // The parent already handles the error state shown on the page.
    }
  }

  const isFuture = occurrence ? new Date(occurrence.scheduledAt).getTime() > Date.now() : false;
  const isPending = occurrence?.status === "PENDING";
  const isActionLoading = occurrence ? loadingActionId === occurrence.id : false;
  const canHandleOccurrence = Boolean(occurrence && isPending && !isFuture);
  const historyItems = useMemo(() => occurrence?.history ?? [], [occurrence]);
  const historyTotalPages = Math.max(1, Math.ceil(historyItems.length / HISTORY_PAGE_SIZE));
  const paginatedHistory = useMemo(() => {
    const startIndex = (historyPage - 1) * HISTORY_PAGE_SIZE;
    return historyItems.slice(startIndex, startIndex + HISTORY_PAGE_SIZE);
  }, [historyItems, historyPage]);

  return (
    <Dialog
      bodyClassName="flex min-h-0 flex-1 flex-col p-0"
      description="Detalhes completos da recorrencia gerada, com historico e contexto da tarefa de origem."
      onClose={onClose}
      open={open}
      size="lg"
      title="Detalhes da recorrencia"
    >
      {loading ? <PageState description="Carregando recorrencia..." title="Carregando" /> : null}
      {!loading && error ? <PageState description={error} title="Erro" /> : null}
      {!loading && occurrence ? (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{occurrence.task.title}</h3>
                  {occurrence.task.notes ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{occurrence.task.notes}</p> : null}
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  {occurrenceStatusWithDateLabel(occurrence)}
                </span>
              </div>

              <div className="grid gap-3 text-sm text-slate-700 dark:text-slate-300 sm:grid-cols-2">
                <p>Codigo da recorrencia: #{occurrence.recurrenceCode}</p>
                <p>Codigo da tarefa: #{occurrence.task.taskCode}</p>
                <p>Data e hora: {formatDateTime(occurrence.scheduledAt)}</p>
                <p>Recorrencia: {recurrenceLabel(occurrence.task)}</p>
                <p>Status da tarefa: {taskStatusWithDateLabel(occurrence.task)}</p>
                <p>Horario previsto da tarefa: {occurrence.task.scheduledTime}</p>
                <p>Favorita: {occurrence.task.isFavorite ? "Sim" : "Nao"}</p>
                <p>Tentativas de notificacao: {occurrence.notificationAttempts ?? 0}</p>
                <p>Tratada em: {occurrence.treatedAt ? formatDateTime(occurrence.treatedAt) : "Ainda nao tratada"}</p>
                <p>Concluida em: {occurrence.completedAt ? formatDateTime(occurrence.completedAt) : "Nao concluida"}</p>
                <p>Ignorada em: {occurrence.ignoredAt ? formatDateTime(occurrence.ignoredAt) : "Nao ignorada"}</p>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Historico da recorrencia</p>
                  {historyItems.length > 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Pagina {historyPage} de {historyTotalPages}
                    </p>
                  ) : null}
                </div>

                {historyItems.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-500">Nenhuma alteracao registrada.</p>
                ) : (
                  <>
                    <div className="space-y-2">
                      {paginatedHistory.map((historyItem) => (
                        <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300" key={historyItem.id}>
                          {occurrenceActionLabel(historyItem.action)} em {formatDateTime(historyItem.actedAt)}
                        </div>
                      ))}
                    </div>

                    {historyTotalPages > 1 ? (
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          disabled={historyPage <= 1}
                          onClick={() => setHistoryPage((current) => Math.max(1, current - 1))}
                          type="button"
                          variant="secondary"
                        >
                          Anterior
                        </Button>
                        <Button
                          disabled={historyPage >= historyTotalPages}
                          onClick={() => setHistoryPage((current) => Math.min(historyTotalPages, current + 1))}
                          type="button"
                          variant="secondary"
                        >
                          Proxima
                        </Button>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="border-t border-slate-200 px-5 py-4 dark:border-slate-800">
            <div className="flex flex-wrap justify-end gap-2">
              {canHandleOccurrence ? (
                <>
                  <Button disabled={isActionLoading} onClick={() => void handleOccurrenceAction("ignore")} type="button" variant="softDanger">
                    {isActionLoading ? "Processando..." : "Ignorar"}
                  </Button>
                  <Button disabled={isActionLoading} onClick={() => void handleOccurrenceAction("complete")} type="button" variant="success">
                    {isActionLoading ? "Processando..." : "Concluir"}
                  </Button>
                </>
              ) : null}
              <Button onClick={onClose} type="button" variant="secondary">
                Fechar
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </Dialog>
  );
}

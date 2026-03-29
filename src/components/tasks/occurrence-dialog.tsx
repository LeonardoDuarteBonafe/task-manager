"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { PageState } from "@/components/ui/page-state";
import { cn } from "@/lib/utils";
import { getOccurrenceDetailsFromCache, syncOccurrenceDetailsFromServer } from "@/lib/offline/offline-store";
import { formatDateTime, occurrenceActionLabel, occurrenceStatusWithDateLabel, recurrenceLabel, taskStatusWithDateLabel } from "./format";
import { getOccurrenceStatusTheme, getTaskStatusTheme } from "./status-theme";
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
        const cached = await getOccurrenceDetailsFromCache(occurrenceId);
        setOccurrence(cached ?? initialOccurrence ?? null);

        if (navigator.onLine) {
          const data = await syncOccurrenceDetailsFromServer(occurrenceId, userId);
          setOccurrence(data);
        }
      } catch (requestError) {
        const cached = await getOccurrenceDetailsFromCache(occurrenceId);
        setOccurrence(cached ?? initialOccurrence ?? null);
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
  const occurrenceTheme = occurrence ? getOccurrenceStatusTheme(occurrence) : null;
  const taskTheme = occurrence ? getTaskStatusTheme(occurrence.task.status) : null;
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
              <div className={cn("overflow-hidden rounded-[1.7rem] border", occurrenceTheme?.frameClassName)}>
                <div className={cn("flex flex-wrap items-center gap-2 px-4 py-3", occurrenceTheme?.bannerClassName)}>
                  <span className={cn("inline-block h-2 w-2 rounded-full", occurrenceTheme?.dotClassName)} />
                  <span className={cn("text-[0.68rem] font-semibold uppercase tracking-[0.24em]", occurrenceTheme?.bannerTextClassName)}>
                    {occurrenceTheme?.label}
                  </span>
                  <span className={cn("text-[0.68rem]", occurrenceTheme?.bannerSubtextClassName)}>{occurrenceStatusWithDateLabel(occurrence)}</span>
                </div>

                <div className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-[var(--border-subtle)] px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[var(--muted-strong)]">
                        Recorrencia #{occurrence.recurrenceCode}
                      </span>
                      <span className="rounded-full border border-[var(--border-subtle)] px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                        Tarefa #{occurrence.task.taskCode}
                      </span>
                      {taskTheme ? (
                        <span className={cn("rounded-full px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.2em]", taskTheme.badgeClassName)}>
                          {taskTheme.label}
                        </span>
                      ) : null}
                    </div>

                    <h3 className="mt-4 text-xl font-semibold text-slate-900 dark:text-slate-100">{occurrence.task.title}</h3>
                    {occurrence.task.notes ? <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">{occurrence.task.notes}</p> : null}

                    <div className="mt-4 grid gap-3 text-sm text-slate-700 dark:text-slate-300 sm:grid-cols-2">
                      <p>Data e hora: {formatDateTime(occurrence.scheduledAt)}</p>
                      <p>Recorrencia: {recurrenceLabel(occurrence.task)}</p>
                      <p>Status da tarefa: {taskStatusWithDateLabel(occurrence.task)}</p>
                      <p>Horario previsto da tarefa: {occurrence.task.scheduledTime}</p>
                      <p>Favorita: {occurrence.task.isFavorite ? "Sim" : "Nao"}</p>
                      <p>Tentativas de notificacao: {occurrence.notificationAttempts ?? 0}</p>
                    </div>
                  </div>

                  <div className={cn("rounded-[1.5rem] border border-[var(--border-subtle)] p-4", occurrenceTheme?.surfaceClassName)}>
                    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[var(--muted-strong)]">Linha do tratamento</p>
                    <div className="mt-4 space-y-3 text-sm text-slate-700 dark:text-slate-300">
                      <div className="rounded-2xl bg-white/50 px-4 py-3 dark:bg-white/5">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Tratada em</p>
                        <p className="mt-1 font-medium">{occurrence.treatedAt ? formatDateTime(occurrence.treatedAt) : "Ainda nao tratada"}</p>
                      </div>
                      <div className="rounded-2xl bg-white/50 px-4 py-3 dark:bg-white/5">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Concluida em</p>
                        <p className="mt-1 font-medium">{occurrence.completedAt ? formatDateTime(occurrence.completedAt) : "Nao concluida"}</p>
                      </div>
                      <div className="rounded-2xl bg-white/50 px-4 py-3 dark:bg-white/5">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Ignorada em</p>
                        <p className="mt-1 font-medium">{occurrence.ignoredAt ? formatDateTime(occurrence.ignoredAt) : "Nao ignorada"}</p>
                      </div>
                    </div>
                  </div>
                </div>
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
                        <div className="flex items-start gap-3 rounded-[1.2rem] border border-[var(--border-subtle)] bg-slate-50/80 px-4 py-3 text-sm text-slate-600 dark:bg-slate-900/70 dark:text-slate-300" key={historyItem.id}>
                          <span className={cn("mt-1 inline-block h-2 w-2 shrink-0 rounded-full", occurrenceTheme?.dotClassName)} />
                          <div>
                            <p className="font-medium text-slate-800 dark:text-slate-100">{occurrenceActionLabel(historyItem.action)}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{formatDateTime(historyItem.actedAt)}</p>
                          </div>
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

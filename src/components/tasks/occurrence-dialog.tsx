"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { PageState } from "@/components/ui/page-state";
import { apiRequest } from "@/lib/http-client";
import { formatDateTime, occurrenceActionLabel, occurrenceStatusLabel, recurrenceLabel, taskStatusLabel } from "./format";
import type { OccurrenceDto } from "./types";

type OccurrenceDetails = OccurrenceDto & {
  completedAt?: string | null;
  ignoredAt?: string | null;
  treatedAt?: string | null;
  notificationAttempts?: number;
  task: OccurrenceDto["task"] & {
    createdAt?: string;
    startDate?: string;
    endDate?: string | null;
    isFavorite: boolean;
  };
  history: Array<{
    id: string;
    action: string;
    actedAt: string;
    fromStatus?: string | null;
    toStatus?: string | null;
  }>;
};

type OccurrenceDialogProps = {
  open: boolean;
  occurrenceId?: string | null;
  userId: string;
  onClose: () => void;
};

export function OccurrenceDialog({ open, occurrenceId, userId, onClose }: OccurrenceDialogProps) {
  const [occurrence, setOccurrence] = useState<OccurrenceDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !occurrenceId) {
      setOccurrence(null);
      setError(null);
      return;
    }

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiRequest<OccurrenceDetails>(`/api/occurrences/${occurrenceId}?userId=${encodeURIComponent(userId)}`);
        setOccurrence(data);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Falha ao carregar recorrencia.");
      } finally {
        setLoading(false);
      }
    })();
  }, [occurrenceId, open, userId]);

  return (
    <Dialog
      description="Detalhes completos da recorrencia gerada, com historico e contexto da tarefa de origem."
      onClose={onClose}
      open={open}
      size="lg"
      title="Detalhes da recorrencia"
    >
      {loading ? <PageState description="Carregando recorrencia..." title="Carregando" /> : null}
      {!loading && error ? <PageState description={error} title="Erro" /> : null}
      {!loading && occurrence ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{occurrence.task.title}</h3>
              {occurrence.task.notes ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{occurrence.task.notes}</p> : null}
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
              {occurrenceStatusLabel(occurrence.status, occurrence.scheduledAt)}
            </span>
          </div>

          <div className="grid gap-3 text-sm text-slate-700 dark:text-slate-300 sm:grid-cols-2">
            <p>Data e hora: {formatDateTime(occurrence.scheduledAt)}</p>
            <p>Recorrencia: {recurrenceLabel(occurrence.task)}</p>
            <p>Status da tarefa: {taskStatusLabel(occurrence.task.status)}</p>
            <p>Horario previsto da tarefa: {occurrence.task.scheduledTime}</p>
            <p>Favorita: {occurrence.task.isFavorite ? "Sim" : "Nao"}</p>
            <p>Tentativas de notificacao: {occurrence.notificationAttempts ?? 0}</p>
            <p>Tratada em: {occurrence.treatedAt ? formatDateTime(occurrence.treatedAt) : "Ainda nao tratada"}</p>
            <p>Concluida em: {occurrence.completedAt ? formatDateTime(occurrence.completedAt) : "Nao concluida"}</p>
            <p>Ignorada em: {occurrence.ignoredAt ? formatDateTime(occurrence.ignoredAt) : "Nao ignorada"}</p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Historico da recorrencia</p>
            {occurrence.history.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-500">Nenhuma alteracao registrada.</p>
            ) : (
              <div className="space-y-2">
                {occurrence.history.map((historyItem) => (
                  <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300" key={historyItem.id}>
                    {occurrenceActionLabel(historyItem.action)} em {formatDateTime(historyItem.actedAt)}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button onClick={onClose} type="button" variant="secondary">
              Fechar
            </Button>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}

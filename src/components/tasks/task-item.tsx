"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { FinalizeTaskDialog } from "./finalize-task-dialog";
import { recurrenceLabel, taskStatusLabel } from "./format";
import type { TaskDto } from "./types";

type TaskItemProps = {
  task: TaskDto;
  onEndTask: (taskId: string, reason?: string) => Promise<void>;
  onToggleFavorite: (taskId: string, isFavorite: boolean) => Promise<void>;
  onOpen: (taskId: string, mode?: "view" | "edit") => void;
  loadingTaskId?: string | null;
  isHighlighted?: boolean;
};

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg aria-hidden="true" className={cn("h-4 w-4", filled ? "fill-current" : "fill-none")} viewBox="0 0 20 20">
      <path
        d="M10 1.75l2.53 5.12 5.65.82-4.09 3.99.97 5.63L10 14.65l-5.06 2.66.97-5.63-4.09-3.99 5.65-.82L10 1.75z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
    </svg>
  );
}

export function TaskItem({ task, onEndTask, onToggleFavorite, onOpen, loadingTaskId, isHighlighted = false }: TaskItemProps) {
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [favoriteAnimating, setFavoriteAnimating] = useState(false);
  const animationTimerRef = useRef<number | null>(null);
  const isLoading = loadingTaskId === task.id;

  async function handleConfirmEnd(reason: string) {
    await onEndTask(task.id, reason || undefined);
    setFinalizeOpen(false);
  }

  useEffect(() => {
    return () => {
      if (animationTimerRef.current) {
        window.clearTimeout(animationTimerRef.current);
      }
    };
  }, []);

  function handleToggleFavoriteClick() {
    setFavoriteAnimating(true);

    if (animationTimerRef.current) {
      window.clearTimeout(animationTimerRef.current);
    }

    animationTimerRef.current = window.setTimeout(() => {
      setFavoriteAnimating(false);
      animationTimerRef.current = null;
    }, 220);

    void onToggleFavorite(task.id, !task.isFavorite);
  }

  return (
    <>
      <Card className={cn("overflow-hidden p-0 transition-shadow", isHighlighted && "ring-2 ring-blue-300 dark:ring-blue-500/60")}>
        <div className="flex flex-col gap-0 md:flex-row">
          <button
            className="min-w-0 flex-1 px-5 py-4 text-left transition hover:bg-slate-50 dark:hover:bg-slate-900/60"
            onClick={() => onOpen(task.id, "view")}
            type="button"
          >
            <h3 className="min-w-0 truncate text-lg font-semibold text-slate-900 dark:text-slate-100">{task.title}</h3>
            <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">Codigo: {task.taskCode}</p>

            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-sm text-slate-600 dark:text-slate-400">{recurrenceLabel(task)}</p>
            </div>

            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Horario: {task.scheduledTime}</p>
          </button>

          <div className="flex w-full shrink-0 flex-col justify-between gap-3 border-t border-slate-200 bg-slate-50/70 px-5 py-4 md:w-[20%] md:min-w-[140px] md:max-w-[300px] md:border-l md:border-t-0 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="flex items-start justify-between gap-3">
              <button
                aria-label={task.isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                className={cn(
                  "inline-flex h-10 w-10 items-center justify-center rounded-full border transition duration-200",
                  task.isFavorite
                    ? "border-amber-300 bg-amber-200 text-amber-700 dark:border-amber-400/40 dark:bg-amber-400/20 dark:text-amber-200"
                    : "border-slate-200 bg-white text-slate-500 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900",
                  favoriteAnimating && "scale-110 shadow-sm",
                )}
                disabled={isLoading}
                onClick={handleToggleFavoriteClick}
                type="button"
              >
                <StarIcon filled={task.isFavorite} />
              </button>
              <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                {taskStatusLabel(task.status)}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 md:justify-end">
              <Button onClick={() => onOpen(task.id, "edit")} type="button" variant="contrast">
                Editar
              </Button>
              {task.status === "ACTIVE" ? (
                <Button disabled={isLoading} onClick={() => setFinalizeOpen(true)} type="button" variant="danger">
                  Finalizar
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </Card>

      <FinalizeTaskDialog loading={isLoading} onClose={() => setFinalizeOpen(false)} onConfirm={handleConfirmEnd} open={finalizeOpen} />
    </>
  );
}

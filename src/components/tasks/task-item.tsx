"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { formatDate, formatTime, recurrenceLabel, taskStatusLabel } from "./format";
import { FinalizeTaskDialog } from "./finalize-task-dialog";
import type { TaskDto } from "./types";

type TaskItemProps = {
  task: TaskDto;
  onEndTask: (taskId: string, reason?: string) => Promise<void>;
  onToggleFavorite: (taskId: string, isFavorite: boolean) => Promise<void>;
  onOpen: (taskId: string, mode?: "view" | "edit") => void;
  loadingTaskId?: string | null;
  isHighlighted?: boolean;
};

type FavoriteAnimationState = "favoriting" | "unfavoriting" | null;

const CARD_SURFACE = "var(--recurrence-card-surface)";

const STATUS_TOKENS: Record<
  TaskDto["status"],
  {
    accent: string;
    border: string;
    banner: string;
    bannerTextClassName: string;
    bannerSubtextClassName: string;
  }
> = {
  ACTIVE: {
    accent: "#1D9E75",
    border: "rgba(29, 158, 117, 0.24)",
    banner: "rgba(29, 158, 117, 0.11)",
    bannerTextClassName: "text-[#0c6e52] dark:text-[#7EE0BC]",
    bannerSubtextClassName: "text-[rgba(12,110,82,0.74)] dark:text-[rgba(126,224,188,0.66)]",
  },
  ENDED: {
    accent: "#6b6f75",
    border: "rgba(107, 111, 117, 0.2)",
    banner: "rgba(107, 111, 117, 0.1)",
    bannerTextClassName: "text-[#43474D] dark:text-[#B8BDC5]",
    bannerSubtextClassName: "text-[rgba(67,71,77,0.72)] dark:text-[rgba(184,189,197,0.62)]",
  },
  CANCELED: {
    accent: "#E24B4A",
    border: "rgba(226, 75, 74, 0.24)",
    banner: "rgba(226, 75, 74, 0.1)",
    bannerTextClassName: "text-[#8f2e2d] dark:text-[#F3A9A8]",
    bannerSubtextClassName: "text-[rgba(143,46,45,0.74)] dark:text-[rgba(243,169,168,0.66)]",
  },
  ABORTED: {
    accent: "#E24B4A",
    border: "rgba(226, 75, 74, 0.24)",
    banner: "rgba(226, 75, 74, 0.1)",
    bannerTextClassName: "text-[#8f2e2d] dark:text-[#F3A9A8]",
    bannerSubtextClassName: "text-[rgba(143,46,45,0.74)] dark:text-[rgba(243,169,168,0.66)]",
  },
};

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg aria-hidden="true" className={cn("h-[1.05rem] w-[1.05rem]", filled ? "fill-current" : "fill-none")} viewBox="0 0 20 20">
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

function PencilIcon() {
  return (
    <svg aria-hidden="true" className="h-[0.95rem] w-[0.95rem] shrink-0" fill="none" viewBox="0 0 16 16">
      <path
        d="M10.95 2.25a1.55 1.55 0 0 1 2.2 2.2L6.1 11.5l-2.85.65.66-2.84 7.04-7.06Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path d="M9.2 4 12 6.8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" className="h-[0.95rem] w-[0.95rem] shrink-0" fill="none" viewBox="0 0 16 16">
      <path d="M3.4 3.4 12.6 12.6M12.6 3.4l-9.2 9.2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg aria-hidden="true" className="h-[0.95rem] w-[0.95rem] shrink-0" fill="none" viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="5.9" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 6.6v3.8M8 5.15h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
    </svg>
  );
}

function useResolvedIsMobile() {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 479px)");
    const sync = () => setMatches(mediaQuery.matches);
    sync();
    mediaQuery.addEventListener("change", sync);
    return () => mediaQuery.removeEventListener("change", sync);
  }, []);

  return matches;
}

function resolveTaskEndedAt(task: Pick<TaskDto, "endedAt" | "canceledAt" | "abortedAt">) {
  return task.endedAt ?? task.canceledAt ?? task.abortedAt;
}

function ActionButton({
  kind,
  label,
  onClick,
  disabled,
  block = false,
}: {
  kind: "edit" | "end" | "view";
  label: string;
  onClick: () => void;
  disabled?: boolean;
  block?: boolean;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[0.95rem] border px-[13px] py-[6px] text-[12px] font-semibold tracking-[0.01em] transition-opacity duration-[120ms] hover:opacity-100 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50",
        block ? "min-h-[42px] flex-1 px-3 py-[9px]" : "min-h-[40px]",
        kind === "edit" &&
          "border-[rgba(55,138,221,0.36)] bg-[rgba(55,138,221,0.12)] text-[#2d6ba7] dark:border-[rgba(55,138,221,0.3)] dark:bg-[rgba(55,138,221,0.14)] dark:text-[#85b7eb]",
        kind === "end" &&
          "border-[rgba(226,75,74,0.5)] bg-[rgba(226,75,74,0.14)] text-[#9c3433] dark:border-[rgba(226,75,74,0.32)] dark:bg-[rgba(226,75,74,0.14)] dark:text-[#f08c8b]",
        kind === "view" &&
          "border-[rgba(28,36,48,0.18)] bg-[rgba(28,36,48,0.04)] text-[rgba(28,36,48,0.7)] dark:border-[rgba(255,255,255,0.12)] dark:bg-[rgba(255,255,255,0.05)] dark:text-[rgba(255,255,255,0.38)]",
      )}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      type="button"
    >
      {kind === "edit" ? <PencilIcon /> : null}
      {kind === "end" ? <CloseIcon /> : null}
      {kind === "view" ? <InfoIcon /> : null}
      <span>{label}</span>
    </button>
  );
}

export function TaskItem({ task, onEndTask, onToggleFavorite, onOpen, loadingTaskId, isHighlighted = false }: TaskItemProps) {
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [favoriteAnimation, setFavoriteAnimation] = useState<FavoriteAnimationState>(null);
  const animationTimerRef = useRef<number | null>(null);
  const isLoading = loadingTaskId === task.id;
  const isMobile = useResolvedIsMobile();
  const tokens = STATUS_TOKENS[task.status];
  const isClosed = task.status !== "ACTIVE";
  const endedAt = resolveTaskEndedAt(task);
  const resolvedAtLabel = endedAt ? `em ${formatDate(endedAt)} as ${formatTime(endedAt)}` : null;

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
    const nextFavoriteState = !task.isFavorite;

    setFavoriteAnimation(nextFavoriteState ? "favoriting" : "unfavoriting");

    if (animationTimerRef.current) {
      window.clearTimeout(animationTimerRef.current);
    }

    animationTimerRef.current = window.setTimeout(() => {
      setFavoriteAnimation(null);
      animationTimerRef.current = null;
    }, nextFavoriteState ? 320 : 180);

    void onToggleFavorite(task.id, nextFavoriteState);
  }

  const favoriteButton = !isClosed ? (
    <button
      aria-label={task.isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      className={cn(
        "task-favorite-button inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border",
        "border-[rgba(28,36,48,0.12)] bg-[rgba(28,36,48,0.04)] text-[#EF9F27] dark:border-[rgba(255,255,255,0.1)] dark:bg-[rgba(255,255,255,0.04)]",
        task.isFavorite &&
          "border-[rgba(186,117,23,0.42)] bg-[rgba(186,117,23,0.16)] text-[#EF9F27] dark:border-[rgba(186,117,23,0.4)] dark:bg-[rgba(186,117,23,0.18)]",
        favoriteAnimation === "favoriting" && "is-favoriting",
        favoriteAnimation === "unfavoriting" && "is-unfavoriting",
      )}
      disabled={isLoading}
      onClick={(event) => {
        event.stopPropagation();
        handleToggleFavoriteClick();
      }}
      type="button"
    >
      <StarIcon filled={task.isFavorite} />
    </button>
  ) : null;

  const infoBlock = (
    <div className={cn("min-w-0", isClosed ? "opacity-[0.52]" : "")}>
      <h3 className="truncate text-[14.5px] font-medium leading-tight text-[rgba(28,36,48,0.96)] dark:text-[#ecedf0]">
        {task.title}
      </h3>
      <div className="mt-2 space-y-0.5 text-[11.5px] leading-[1.7] text-[rgba(28,36,48,0.56)] dark:text-[rgba(255,255,255,0.32)]">
        <p>Codigo: {task.taskCode}</p>
        <p>Horario: {task.scheduledTime}</p>
        <p>Recorrencia: {recurrenceLabel(task)}</p>
      </div>
    </div>
  );

  return (
    <>
      <div
        className={cn(
          "overflow-hidden border transition-[border-color,box-shadow] duration-200",
          isHighlighted && "ring-2 ring-blue-300 dark:ring-blue-500/60",
        )}
        style={{
          backgroundColor: CARD_SURFACE,
          borderColor: tokens.border,
          borderRadius: isMobile ? "11px" : "13px",
        }}
      >
        <div
          className={cn("flex items-center gap-2 border-b px-4 py-[5px]", isMobile && "px-3.5")}
          style={{
            backgroundColor: tokens.banner,
            borderBottomColor: tokens.border,
          }}
        >
          <span className="inline-block h-[6px] w-[6px] rounded-full" style={{ backgroundColor: tokens.accent }} />
          <span className={cn("text-[10.5px] font-semibold uppercase tracking-[0.07em]", tokens.bannerTextClassName)}>
            {taskStatusLabel(task.status)}
          </span>
          {resolvedAtLabel ? (
            <span className={cn("truncate text-[10.5px]", tokens.bannerSubtextClassName)}>
              {resolvedAtLabel}
            </span>
          ) : null}
        </div>

        {isMobile ? (
          <div className="px-3.5 py-3">
            <div className="flex items-start gap-3">
              <button className="min-w-0 flex-1 text-left" onClick={() => onOpen(task.id, "view")} type="button">
                {infoBlock}
              </button>
              {favoriteButton}
            </div>

            <div className="mt-3 flex gap-2">
              {isClosed ? (
                <ActionButton block kind="view" label="Ver tarefa" onClick={() => onOpen(task.id, "view")} />
              ) : (
                <>
                  <ActionButton block kind="edit" label="Editar" onClick={() => onOpen(task.id, "edit")} />
                  <ActionButton block disabled={isLoading} kind="end" label="Encerrar" onClick={() => setFinalizeOpen(true)} />
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-stretch gap-4 px-4 py-3.5">
            <button className="min-w-0 flex-[1_1_18rem] text-left" onClick={() => onOpen(task.id, "view")} type="button">
              {infoBlock}
            </button>

            <div className="ml-auto flex min-w-fit shrink-0 flex-col items-end justify-between gap-3">
              {favoriteButton}
              <div className="flex items-center justify-end gap-2 self-stretch">
                {isClosed ? (
                  <ActionButton kind="view" label="Ver tarefa" onClick={() => onOpen(task.id, "view")} />
                ) : (
                  <>
                    <ActionButton kind="edit" label="Editar" onClick={() => onOpen(task.id, "edit")} />
                    <ActionButton disabled={isLoading} kind="end" label="Encerrar" onClick={() => setFinalizeOpen(true)} />
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <FinalizeTaskDialog loading={isLoading} onClose={() => setFinalizeOpen(false)} onConfirm={handleConfirmEnd} open={finalizeOpen} />
    </>
  );
}

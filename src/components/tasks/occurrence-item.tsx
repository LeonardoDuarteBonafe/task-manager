"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { formatDate, formatTime, recurrenceLabel } from "./format";
import type { OccurrenceDto } from "./types";

type BaseOccurrenceItemProps = {
  occurrence: OccurrenceDto;
  onComplete?: (id: string) => Promise<void>;
  onIgnore?: (id: string) => Promise<void>;
  onOpen?: (id: string) => void;
  onViewTask?: (taskCode: number) => void;
  loadingActionId?: string | null;
};

type RecurrenceCardProps = BaseOccurrenceItemProps & {
  isMobile: boolean;
};

type OccurrenceItemProps = BaseOccurrenceItemProps & {
  isMobile?: boolean;
};

type RecurrenceVisualStatus = "vencida" | "concluida" | "ignorada" | "proxima";

const CARD_SURFACE = "var(--recurrence-card-surface)";
const SHEET_SURFACE = "var(--recurrence-sheet-surface)";
const SHEET_BEZIER = "cubic-bezier(0.32, 0.72, 0, 1)";
const DESKTOP_ACTION_GAP = 12;

const STATUS_TOKENS: Record<
  RecurrenceVisualStatus,
  {
    label: string;
    accent: string;
    border: string;
    banner: string;
    bannerTextClassName: string;
    bannerSubtextClassName: string;
  }
> = {
  vencida: {
    label: "Vencida",
    accent: "#E24B4A",
    border: "rgba(226, 75, 74, 0.22)",
    banner: "rgba(226, 75, 74, 0.10)",
    bannerTextClassName: "text-[#8F2E2D] dark:text-[#F3A9A8]",
    bannerSubtextClassName: "text-[rgba(143,46,45,0.76)] dark:text-[rgba(243,169,168,0.68)]",
  },
  concluida: {
    label: "Concluida",
    accent: "#1D9E75",
    border: "rgba(29, 158, 117, 0.22)",
    banner: "rgba(29, 158, 117, 0.10)",
    bannerTextClassName: "text-[#0C6E52] dark:text-[#7EE0BC]",
    bannerSubtextClassName: "text-[rgba(12,110,82,0.76)] dark:text-[rgba(126,224,188,0.68)]",
  },
  ignorada: {
    label: "Ignorada",
    accent: "#6b6f75",
    border: "rgba(107, 111, 117, 0.20)",
    banner: "rgba(107, 111, 117, 0.10)",
    bannerTextClassName: "text-[#43474D] dark:text-[#B8BDC5]",
    bannerSubtextClassName: "text-[rgba(67,71,77,0.74)] dark:text-[rgba(184,189,197,0.62)]",
  },
  proxima: {
    label: "Proxima",
    accent: "#8BA3C7",
    border: "rgba(139, 163, 199, 0.20)",
    banner: "rgba(139, 163, 199, 0.10)",
    bannerTextClassName: "text-[#425B80] dark:text-[#B8CBE6]",
    bannerSubtextClassName: "text-[rgba(66,91,128,0.72)] dark:text-[rgba(184,203,230,0.62)]",
  },
};

const BUTTON_TOKENS = {
  concluir: {
    background: "rgba(29, 158, 117, 0.18)",
    className:
      "border-[rgba(29,158,117,0.56)] text-[#0c6e52] dark:border-[rgba(29,158,117,0.38)] dark:text-[#4dcca8]",
  },
  ignorar: {
    background: "rgba(226, 75, 74, 0.14)",
    className:
      "border-[rgba(226,75,74,0.5)] text-[#9c3433] dark:border-[rgba(226,75,74,0.32)] dark:text-[#f08c8b]",
  },
  visualizar: {
    background: "rgba(255, 255, 255, 0.05)",
    className:
      "border-[rgba(28,36,48,0.24)] text-[rgba(28,36,48,0.82)] dark:border-[rgba(255,255,255,0.12)] dark:text-[rgba(255,255,255,0.38)]",
  },
} as const;

function CheckIcon() {
  return (
    <svg aria-hidden="true" className="h-[0.95rem] w-[0.95rem] shrink-0" fill="none" viewBox="0 0 16 16">
      <path d="M2.5 8.3 6.15 11.6 13.4 3.95" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
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

function useResolvedIsMobile(isMobile?: boolean) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof isMobile === "boolean") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const sync = () => setMatches(mediaQuery.matches);
    sync();
    mediaQuery.addEventListener("change", sync);
    return () => mediaQuery.removeEventListener("change", sync);
  }, [isMobile]);

  return typeof isMobile === "boolean" ? isMobile : matches;
}

function resolveVisualStatus(occurrence: OccurrenceDto): RecurrenceVisualStatus {
  if (occurrence.status === "COMPLETED") {
    return "concluida";
  }

  if (occurrence.status === "IGNORED") {
    return "ignorada";
  }

  return new Date(occurrence.scheduledAt).getTime() < Date.now() ? "vencida" : "proxima";
}

function getResolvedAtLabel(occurrence: OccurrenceDto) {
  if (occurrence.status === "PENDING") {
    return null;
  }

  const targetAction = occurrence.status === "COMPLETED" ? "COMPLETED" : "IGNORED";
  const resolvedAt = occurrence.history.find((historyItem) => historyItem.action === targetAction)?.actedAt;

  if (!resolvedAt) {
    return null;
  }

  return `em ${formatDate(resolvedAt)} as ${formatTime(resolvedAt)}`;
}

function ActionButton({
  kind,
  label,
  onClick,
  disabled,
  block = false,
  large = false,
}: {
  kind: "concluir" | "ignorar" | "visualizar";
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  block?: boolean;
  large?: boolean;
}) {
  const tokens = BUTTON_TOKENS[kind];

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[0.95rem] border px-3.5 font-semibold tracking-[0.01em] shadow-none transition-opacity duration-[120ms] hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-50",
        block ? "w-full" : "",
        large ? "min-h-[46px] py-[11px] text-[0.92rem]" : "min-h-[40px] py-[9px] text-[0.88rem]",
        tokens.className,
      )}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
      style={{
        backgroundColor: tokens.background,
        opacity: kind === "visualizar" ? 0.96 : 1,
      }}
      type="button"
    >
      {kind === "concluir" ? <CheckIcon /> : null}
      {kind === "ignorar" ? <CloseIcon /> : null}
      {kind === "visualizar" ? <InfoIcon /> : null}
      <span>{label}</span>
    </button>
  );
}

function MobileBottomSheet({
  open,
  occurrence,
  tokens,
  canAct,
  loading,
  onClose,
  onComplete,
  onIgnore,
  onViewTask,
}: {
  open: boolean;
  occurrence: OccurrenceDto;
  tokens: (typeof STATUS_TOKENS)[RecurrenceVisualStatus];
  canAct: boolean;
  loading: boolean;
  onClose: () => void;
  onComplete?: (id: string) => Promise<void>;
  onIgnore?: (id: string) => Promise<void>;
  onViewTask?: (taskCode: number) => void;
}) {
  const [renderSheet, setRenderSheet] = useState(open);
  const [sheetVisible, setSheetVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setRenderSheet(true);
      const frameId = window.requestAnimationFrame(() => setSheetVisible(true));
      return () => window.cancelAnimationFrame(frameId);
    }

    setSheetVisible(false);
    return undefined;
  }, [open]);

  useEffect(() => {
    if (!renderSheet || sheetVisible) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setRenderSheet(false), 280);
    return () => window.clearTimeout(timeoutId);
  }, [renderSheet, sheetVisible]);

  useEffect(() => {
    if (!renderSheet) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [renderSheet, onClose]);

  if (!renderSheet) {
    return null;
  }

  async function handleComplete() {
    if (!onComplete) {
      return;
    }

    await onComplete(occurrence.id);
    onClose();
  }

  async function handleIgnore() {
    if (!onIgnore) {
      return;
    }

    await onIgnore(occurrence.id);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center">
      <button
        aria-label="Fechar opcoes da recorrencia"
        className={cn(
          "absolute inset-0 transition-opacity duration-200",
          sheetVisible ? "opacity-100" : "opacity-0",
        )}
        onClick={onClose}
        style={{ backgroundColor: "rgba(12, 16, 20, 0.72)" }}
        type="button"
      />

      <div
        aria-modal="true"
        className="relative z-10 w-full rounded-t-[18px] border-t px-4 pb-5 pt-3 shadow-[0_-18px_48px_rgba(5,8,11,0.42)]"
        role="dialog"
        style={{
          backgroundColor: SHEET_SURFACE,
          borderTopColor: "rgba(255, 255, 255, 0.08)",
          transform: sheetVisible ? "translateY(0)" : "translateY(100%)",
          transition: `transform 280ms ${SHEET_BEZIER}`,
        }}
      >
        <div className="mx-auto h-1.5 w-12 rounded-full bg-white/14" />

        <div
          className="mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5"
          style={{
            backgroundColor: tokens.banner,
            borderColor: tokens.border,
          }}
        >
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: tokens.accent }} />
          <span className={cn("text-[0.7rem] font-semibold uppercase tracking-[0.06em]", tokens.bannerTextClassName)}>{tokens.label}</span>
        </div>

        <div className="mt-4">
          <h3 className="text-[1.05rem] font-semibold leading-tight text-[rgba(28,36,48,0.96)] dark:text-[rgba(232,236,241,0.96)]">
            {occurrence.task.title}
          </h3>
          <div className="mt-3 space-y-1.5 text-[0.84rem] text-[rgba(28,36,48,0.78)] dark:text-[rgba(203,210,218,0.8)]">
            <p>Vence em {formatDate(occurrence.scheduledAt)} as {formatTime(occurrence.scheduledAt)}</p>
            <p>Recorrencia: {recurrenceLabel(occurrence.task)}</p>
            <p>Tarefa #{occurrence.task.taskCode}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2.5">
          {canAct ? (
            <>
              <ActionButton
                block
                disabled={loading}
                kind="concluir"
                label={loading ? "Processando..." : "Concluir"}
                large
                onClick={() => void handleComplete()}
              />
              <ActionButton
                block
                disabled={loading}
                kind="ignorar"
                label={loading ? "Processando..." : "Ignorar"}
                large
                onClick={() => void handleIgnore()}
              />
            </>
          ) : null}
          <ActionButton block kind="visualizar" label="Ver tarefa completa" large onClick={() => onViewTask?.(occurrence.task.taskCode)} />
        </div>
      </div>
    </div>
  );
}

export function RecurrenceCard({
  occurrence,
  onComplete,
  onIgnore,
  onOpen,
  onViewTask,
  loadingActionId,
  isMobile,
}: RecurrenceCardProps) {
  const visualStatus = resolveVisualStatus(occurrence);
  const tokens = STATUS_TOKENS[visualStatus];
  const isClosed = visualStatus === "concluida" || visualStatus === "ignorada";
  const isFuture = visualStatus === "proxima";
  const canAct = !isClosed && !isFuture && occurrence.status === "PENDING";
  const resolvedAtLabel = getResolvedAtLabel(occurrence);
  const isLoading = loadingActionId === occurrence.id;
  const [sheetOpen, setSheetOpen] = useState(false);
  const [actionsWrapped, setActionsWrapped] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const infoRef = useRef<HTMLDivElement | null>(null);
  const actionsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isMobile) {
      setActionsWrapped(false);
      return undefined;
    }

    const root = rootRef.current;
    const info = infoRef.current;
    const actions = actionsRef.current;

    if (!root || !info || !actions) {
      return undefined;
    }

    const measure = () => {
      const wrappedByPosition = actions.offsetTop > info.offsetTop + 4;
      const wrappedByWidth = info.clientWidth + actions.clientWidth + DESKTOP_ACTION_GAP > root.clientWidth;
      setActionsWrapped(wrappedByPosition || wrappedByWidth);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    observer.observe(info);
    observer.observe(actions);
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [isMobile, occurrence.id, occurrence.task.title]);

  const infoBlock = (
    <div className={cn("min-w-0 flex-1", isClosed ? "opacity-[0.52]" : "")} ref={infoRef}>
      <h3 className="truncate text-[1.02rem] font-semibold leading-tight text-[rgba(28,36,48,0.96)] dark:text-[rgba(232,236,241,0.96)]">
        {occurrence.task.title}
      </h3>
      <div className="mt-2 space-y-1 text-[0.84rem] text-[rgba(28,36,48,0.78)] dark:text-[rgba(203,210,218,0.82)]">
        <p>Vence em {formatDate(occurrence.scheduledAt)} as {formatTime(occurrence.scheduledAt)}</p>
        <p>Recorrencia: {recurrenceLabel(occurrence.task)}</p>
      </div>
    </div>
  );

  if (isMobile) {
    const isCardInteractive = !isClosed;

    return (
      <>
        <div
          className={cn(
            "grain-overlay overflow-hidden border backdrop-blur-[18px]",
            isCardInteractive ? "cursor-pointer" : "cursor-default",
          )}
          onClick={() => {
            if (isCardInteractive) {
              setSheetOpen(true);
            }
          }}
          onKeyDown={(event) => {
            if (!isCardInteractive) {
              return;
            }

            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setSheetOpen(true);
            }
          }}
          ref={rootRef}
          role={isCardInteractive ? "button" : undefined}
          style={{
            backgroundColor: CARD_SURFACE,
            borderColor: tokens.border,
            borderRadius: "11px",
          }}
          tabIndex={isCardInteractive ? 0 : -1}
        >
          <div
            className="flex items-center gap-2 border-b px-3.5 py-2"
            style={{
              backgroundColor: tokens.banner,
              borderBottomColor: tokens.border,
            }}
          >
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: tokens.accent }} />
            <span className={cn("text-[0.68rem] font-semibold uppercase tracking-[0.06em]", tokens.bannerTextClassName)}>
              {tokens.label}
            </span>
            {resolvedAtLabel ? (
              <span className={cn("truncate text-[0.68rem]", tokens.bannerSubtextClassName)}>
                {resolvedAtLabel}
              </span>
            ) : null}
          </div>

          <div className={cn("px-3.5 py-3", isClosed ? "opacity-[0.52]" : "")}>
            <h3 className="truncate text-[0.98rem] font-semibold leading-tight text-[rgba(28,36,48,0.96)] dark:text-[rgba(232,236,241,0.96)]">
              {occurrence.task.title}
            </h3>
            <div className="mt-2 space-y-1 text-[0.82rem] text-[rgba(28,36,48,0.78)] dark:text-[rgba(203,210,218,0.82)]">
              <p>Vence em {formatDate(occurrence.scheduledAt)} as {formatTime(occurrence.scheduledAt)}</p>
              <p>Recorrencia: {recurrenceLabel(occurrence.task)}</p>
            </div>

            {canAct ? (
              <div className="mt-3 flex gap-2" onClick={(event) => event.stopPropagation()}>
                <div className="flex-1">
                  <ActionButton
                    block
                    disabled={isLoading}
                    kind="concluir"
                    label={isLoading ? "Processando..." : "Concluir"}
                    onClick={() => void onComplete?.(occurrence.id)}
                  />
                </div>
                <div className="flex-1">
                  <ActionButton
                    block
                    disabled={isLoading}
                    kind="ignorar"
                    label={isLoading ? "Processando..." : "Ignorar"}
                    onClick={() => void onIgnore?.(occurrence.id)}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <MobileBottomSheet
          canAct={canAct}
          loading={isLoading}
          occurrence={occurrence}
          onClose={() => setSheetOpen(false)}
          onComplete={onComplete}
          onIgnore={onIgnore}
          onViewTask={onViewTask}
          open={sheetOpen}
          tokens={tokens}
        />
      </>
    );
  }

  const desktopInfoClassName = "min-w-0 flex-[1_1_19rem] text-left";

  return (
    <div
      className="grain-overlay overflow-hidden border backdrop-blur-[18px]"
      ref={rootRef}
      style={{
        backgroundColor: CARD_SURFACE,
        borderColor: tokens.border,
        borderRadius: "13px",
      }}
    >
      <div
        className="flex items-center gap-2 border-b px-4 py-2.5"
        style={{
          backgroundColor: tokens.banner,
          borderBottomColor: tokens.border,
        }}
      >
        <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: tokens.accent }} />
        <span className={cn("text-[0.7rem] font-semibold uppercase tracking-[0.06em]", tokens.bannerTextClassName)}>
          {tokens.label}
        </span>
        {resolvedAtLabel ? (
          <span className={cn("truncate text-[0.7rem]", tokens.bannerSubtextClassName)}>
            {resolvedAtLabel}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-start gap-3 px-4 py-3.5">
        {isClosed ? (
          <div className={desktopInfoClassName}>{infoBlock}</div>
        ) : (
          <button className={desktopInfoClassName} onClick={() => onOpen?.(occurrence.id)} type="button">
            {infoBlock}
          </button>
        )}

        <div
          className={cn(
            "flex shrink-0 flex-nowrap items-center gap-2",
            actionsWrapped ? "flex-[1_1_100%] justify-end pt-1" : "ml-auto",
          )}
          ref={actionsRef}
        >
          {canAct ? (
            <>
              <ActionButton
                disabled={isLoading}
                kind="concluir"
                label={isLoading ? "Processando..." : "Concluir"}
                onClick={() => void onComplete?.(occurrence.id)}
              />
              <ActionButton
                disabled={isLoading}
                kind="ignorar"
                label={isLoading ? "Processando..." : "Ignorar"}
                onClick={() => void onIgnore?.(occurrence.id)}
              />
            </>
          ) : (
            <ActionButton kind="visualizar" label={isFuture ? "Detalhes" : "Ver tarefa"} onClick={() => onViewTask?.(occurrence.task.taskCode)} />
          )}
        </div>
      </div>
    </div>
  );
}

export function OccurrenceItem(props: OccurrenceItemProps) {
  const resolvedIsMobile = useResolvedIsMobile(props.isMobile);

  return <RecurrenceCard {...props} isMobile={resolvedIsMobile} />;
}

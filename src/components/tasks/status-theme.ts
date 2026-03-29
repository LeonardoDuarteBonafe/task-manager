import type { OccurrenceDetailsDto, OccurrenceDto, TaskDto } from "./types";

export type StatusTone = "danger" | "success" | "warning" | "neutral" | "info";

type StatusToneClasses = {
  bannerClassName: string;
  bannerTextClassName: string;
  bannerSubtextClassName: string;
  frameClassName: string;
  badgeClassName: string;
  dotClassName: string;
  surfaceClassName: string;
  mutedTextClassName: string;
  hintTextClassName: string;
};

export type StatusTheme = {
  label: string;
  tone: StatusTone;
  isClosed: boolean;
} & StatusToneClasses;

const STATUS_TONE_CLASSES: Record<StatusTone, StatusToneClasses> = {
  danger: {
    bannerClassName: "border-b border-rose-400/20 bg-rose-500/12",
    bannerTextClassName: "text-rose-200",
    bannerSubtextClassName: "text-rose-100/70",
    frameClassName: "border-rose-400/20",
    badgeClassName: "border border-rose-400/22 bg-rose-500/12 text-rose-100",
    dotClassName: "bg-rose-400",
    surfaceClassName: "bg-rose-500/[0.07]",
    mutedTextClassName: "text-rose-100/70",
    hintTextClassName: "text-rose-100/60",
  },
  success: {
    bannerClassName: "border-b border-emerald-400/20 bg-emerald-500/12",
    bannerTextClassName: "text-emerald-200",
    bannerSubtextClassName: "text-emerald-100/70",
    frameClassName: "border-emerald-400/18",
    badgeClassName: "border border-emerald-400/22 bg-emerald-500/12 text-emerald-100",
    dotClassName: "bg-emerald-400",
    surfaceClassName: "bg-emerald-500/[0.07]",
    mutedTextClassName: "text-emerald-100/70",
    hintTextClassName: "text-emerald-100/60",
  },
  warning: {
    bannerClassName: "border-b border-amber-400/22 bg-amber-500/14",
    bannerTextClassName: "text-amber-100",
    bannerSubtextClassName: "text-amber-50/70",
    frameClassName: "border-amber-400/22",
    badgeClassName: "border border-amber-400/22 bg-amber-500/14 text-amber-50",
    dotClassName: "bg-amber-300",
    surfaceClassName: "bg-amber-500/[0.08]",
    mutedTextClassName: "text-amber-50/75",
    hintTextClassName: "text-amber-50/65",
  },
  neutral: {
    bannerClassName: "border-b border-white/10 bg-white/[0.05]",
    bannerTextClassName: "text-slate-200 dark:text-slate-200",
    bannerSubtextClassName: "text-slate-500 dark:text-slate-400",
    frameClassName: "border-[var(--border-strong)]",
    badgeClassName:
      "border border-slate-300/70 bg-slate-200/75 text-slate-700 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200",
    dotClassName: "bg-slate-500 dark:bg-slate-400",
    surfaceClassName: "bg-slate-500/[0.05]",
    mutedTextClassName: "text-slate-600 dark:text-slate-300/80",
    hintTextClassName: "text-slate-500 dark:text-slate-400",
  },
  info: {
    bannerClassName: "border-b border-sky-400/20 bg-sky-500/12",
    bannerTextClassName: "text-sky-200",
    bannerSubtextClassName: "text-sky-100/70",
    frameClassName: "border-sky-400/20",
    badgeClassName: "border border-sky-400/22 bg-sky-500/12 text-sky-100",
    dotClassName: "bg-sky-300",
    surfaceClassName: "bg-sky-500/[0.07]",
    mutedTextClassName: "text-sky-100/70",
    hintTextClassName: "text-sky-100/60",
  },
};

const TONE_ALIASES: Record<string, StatusTone> = {
  valid: "success",
  success: "success",
  completed: "success",
  complete: "success",
  done: "success",
  error: "danger",
  danger: "danger",
  canceled: "danger",
  cancelled: "danger",
  aborted: "danger",
  failed: "danger",
  warning: "warning",
  overdue: "warning",
  delayed: "warning",
  postponed: "warning",
  neutral: "neutral",
  ignored: "neutral",
  muted: "neutral",
  info: "info",
  pending: "info",
  active: "info",
  upcoming: "info",
};

function normalizeMeaning(meaning?: string | null) {
  return meaning?.trim().toLowerCase().replace(/\s+/g, "_") ?? "";
}

export function resolveStatusTone(meaning?: string | null): StatusTone {
  return TONE_ALIASES[normalizeMeaning(meaning)] ?? "neutral";
}

export function buildStatusTheme({
  label,
  meaning,
  isClosed = false,
}: {
  label: string;
  meaning?: string | null;
  isClosed?: boolean;
}): StatusTheme {
  const tone = resolveStatusTone(meaning);

  return {
    label,
    tone,
    isClosed,
    ...STATUS_TONE_CLASSES[tone],
  };
}

// When statuses become dynamic from the database, the frontend can keep using
// `label + meaning` and avoid tying colors to exact status names.
export function getOccurrenceStatusTheme(
  occurrence: Pick<OccurrenceDto, "status" | "scheduledAt" | "isEnded"> | Pick<OccurrenceDetailsDto, "status" | "scheduledAt" | "isEnded">,
): StatusTheme {
  if (occurrence.status === "COMPLETED") {
    return buildStatusTheme({ label: "Concluida", meaning: "success", isClosed: true });
  }

  if (occurrence.status === "IGNORED") {
    return buildStatusTheme({ label: "Ignorada", meaning: "neutral", isClosed: true });
  }

  const isOverdue = new Date(occurrence.scheduledAt).getTime() < Date.now();
  return buildStatusTheme({
    label: isOverdue ? "Vencida" : "Proxima",
    meaning: isOverdue ? "warning" : "info",
    isClosed: false,
  });
}

export function getTaskStatusTheme(status: TaskDto["status"]): StatusTheme {
  switch (status) {
    case "ACTIVE":
      return buildStatusTheme({ label: "Ativa", meaning: "info" });
    case "ENDED":
      return buildStatusTheme({ label: "Finalizada", meaning: "neutral", isClosed: true });
    case "CANCELED":
      return buildStatusTheme({ label: "Cancelada", meaning: "danger", isClosed: true });
    case "ABORTED":
      return buildStatusTheme({ label: "Abortada", meaning: "danger", isClosed: true });
    default:
      return buildStatusTheme({ label: status, meaning: "neutral" });
  }
}

"use client";

import { useEffect, useState } from "react";
import { getOfflineRuntimeSnapshot, hydrateOfflineRuntimeState } from "@/lib/offline/offline-store";
import { OFFLINE_RUNTIME_EVENT, type OfflineRuntimeState } from "@/lib/offline/events";

type OfflineStatusProps = {
  compact?: boolean;
};

function isSynced(state: OfflineRuntimeState) {
  return (
    state.connectivity !== "offline" &&
    state.syncPhase !== "bootstrapping" &&
    state.syncPhase !== "syncing" &&
    state.syncPhase !== "error" &&
    state.pendingCount === 0 &&
    state.failedCount === 0
  );
}

function buildLabel(state: OfflineRuntimeState) {
  if (state.connectivity === "offline") {
    return state.pendingCount > 0 ? `Offline com ${state.pendingCount} alteracao(oes) pendente(s)` : "Offline usando dados locais";
  }

  if (state.syncPhase === "bootstrapping") {
    return "Preparando dados offline";
  }

  if (state.syncPhase === "syncing") {
    return state.pendingCount > 0 ? `Sincronizando ${state.pendingCount} alteracao(oes)` : "Sincronizando dados";
  }

  if (state.failedCount > 0) {
    return `${state.failedCount} sincronizacao(oes) falharam`;
  }

  return state.pendingCount > 0 ? `${state.pendingCount} alteracao(oes) aguardando sync` : "Online e sincronizado";
}

function buildTone(state: OfflineRuntimeState) {
  if (state.connectivity === "offline") {
    return "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100";
  }

  if (state.syncPhase === "error" || state.failedCount > 0) {
    return "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100";
  }

  if (state.syncPhase === "bootstrapping" || state.syncPhase === "syncing" || state.pendingCount > 0) {
    return "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100";
}

export function OfflineStatus({ compact = false }: OfflineStatusProps) {
  const [state, setState] = useState<OfflineRuntimeState>(getOfflineRuntimeSnapshot());

  useEffect(() => {
    const refresh = () => {
      void hydrateOfflineRuntimeState().then(setState);
    };

    refresh();
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    window.addEventListener(OFFLINE_RUNTIME_EVENT, refresh);

    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
      window.removeEventListener(OFFLINE_RUNTIME_EVENT, refresh);
    };
  }, []);

  const label = buildLabel(state);
  const detail = state.lastSyncAt ? `Ultimo sync: ${new Date(state.lastSyncAt).toLocaleString("pt-BR")}` : state.lastSyncError;
  const title = detail ? `${label} - ${detail}` : label;
  const tone = buildTone(state);
  const synced = isSynced(state);

  if (compact) {
    return (
      <div aria-label={label} className={`flex h-11 w-full items-center justify-center rounded-2xl border ${tone}`} title={title}>
        <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
          <path d="M6 10a6 6 0 0 1 6-6h3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
          <path d="m13.5 2.75 3 1.5-1.5 3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
          <path d="M18 14a6 6 0 0 1-6 6H9" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
          <path d="m10.5 21.25-3-1.5 1.5-3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
          {synced ? (
            <path d="m9 12.4 2 2 4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
          ) : (
            <>
              <path d="M12 9v4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
              <circle cx="12" cy="16.25" fill="currentColor" r="1" />
            </>
          )}
        </svg>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border px-3 py-2 text-xs font-medium ${tone}`}>
      <p>{label}</p>
      {state.lastSyncAt ? <p className="mt-1 opacity-80">Ultimo sync: {new Date(state.lastSyncAt).toLocaleString("pt-BR")}</p> : null}
      {state.lastSyncError ? <p className="mt-1 opacity-80">{state.lastSyncError}</p> : null}
    </div>
  );
}

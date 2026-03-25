export const OFFLINE_RUNTIME_EVENT = "taskmanager-offline-runtime";

export type OfflineConnectivity = "online" | "offline";
export type OfflineSyncPhase = "idle" | "bootstrapping" | "syncing" | "error";

export type OfflineRuntimeState = {
  connectivity: OfflineConnectivity;
  syncPhase: OfflineSyncPhase;
  pendingCount: number;
  failedCount: number;
  lastSyncAt: string | null;
  lastSyncError: string | null;
};

export function createDefaultOfflineRuntimeState(): OfflineRuntimeState {
  return {
    connectivity: typeof navigator !== "undefined" && navigator.onLine ? "online" : "offline",
    syncPhase: "idle",
    pendingCount: 0,
    failedCount: 0,
    lastSyncAt: null,
    lastSyncError: null,
  };
}

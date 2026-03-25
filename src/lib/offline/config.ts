export const OFFLINE_DB_NAME = "taskmanager-offline";
export const OFFLINE_DB_VERSION = 2;

export const OFFLINE_PAGE_SIZE = 10;
export const OFFLINE_OCCURRENCE_HORIZON_DAYS = 90;
export const OFFLINE_SYNC_TAG = "taskmanager-offline-sync";

export const OFFLINE_SUPPORTED_ROUTES = ["/", "/dashboard", "/tasks", "/recorrencias"] as const;
export const OFFLINE_FALLBACK_ROUTE = "/offline";

export function isOfflineSupportedPath(pathname: string) {
  return OFFLINE_SUPPORTED_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

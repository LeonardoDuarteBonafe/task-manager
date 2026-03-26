export const OFFLINE_DB_NAME = "taskmanager-offline";
export const OFFLINE_DB_VERSION = 3;

export const OFFLINE_PAGE_SIZE = 10;
export const OFFLINE_OCCURRENCE_HORIZON_DAYS = 90;
export const OFFLINE_BOOTSTRAP_LOOKBACK_DAYS = 30;
export const OFFLINE_SYNC_TAG = "taskmanager-offline-sync";
export const OFFLINE_ROUTE_CACHE = "taskmanager-routes-v3";

export const OFFLINE_SUPPORTED_ROUTES = ["/", "/dashboard", "/tasks", "/recorrencias", "/configuracoes", "/meu-perfil"] as const;
export const OFFLINE_FALLBACK_ROUTE = "/offline";

export function isOfflineSupportedPath(pathname: string) {
  return OFFLINE_SUPPORTED_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

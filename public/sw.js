const STATIC_CACHE = "taskmanager-static-v2";
const ROUTE_CACHE = "taskmanager-routes-v2";
const RUNTIME_CACHE = "taskmanager-runtime-v2";
const OFFLINE_FALLBACK_ROUTE = "/offline";
const OFFLINE_SUPPORTED_ROUTES = ["/", "/dashboard", "/tasks", "/recorrencias"];
const STATIC_ASSETS = ["/manifest.webmanifest", "/icons/icon-192.svg", "/icons/icon-512.svg", OFFLINE_FALLBACK_ROUTE];

function createNotificationId(prefix = "desktop") {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isStaticAsset(pathname) {
  return pathname.startsWith("/_next/static/") || pathname.startsWith("/icons/") || pathname === "/manifest.webmanifest";
}

function isOfflineSupportedPath(pathname) {
  return OFFLINE_SUPPORTED_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

async function cacheSuccessfulResponse(cacheName, request, response) {
  if (!response || !response.ok) {
    return response;
  }

  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => ![STATIC_CACHE, ROUTE_CACHE, RUNTIME_CACHE].includes(key))
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);

  if (event.request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(event.request);
          return cacheSuccessfulResponse(ROUTE_CACHE, requestUrl.pathname, response);
        } catch {
          const exactMatch = await caches.match(event.request, { ignoreSearch: true });
          if (exactMatch) {
            return exactMatch;
          }

          if (isOfflineSupportedPath(requestUrl.pathname)) {
            const cachedRoute = await caches.match(requestUrl.pathname, { ignoreSearch: true });
            if (cachedRoute) {
              return cachedRoute;
            }
          }

          return (await caches.match(OFFLINE_FALLBACK_ROUTE)) || Response.error();
        }
      })(),
    );
    return;
  }

  if (!isStaticAsset(requestUrl.pathname)) {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(event.request);
          return cacheSuccessfulResponse(RUNTIME_CACHE, event.request, response);
        } catch {
          return (await caches.match(event.request, { ignoreSearch: true })) || Response.error();
        }
      })(),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((response) => cacheSuccessfulResponse(STATIC_CACHE, event.request, response))
        .catch(() => caches.match(event.request));
    }),
  );
});

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "TaskManager";
  const notificationId = data.notificationId || createNotificationId(data.channel || "desktop");
  const options = {
    body: data.body || "Voce tem uma nova atualizacao de tarefa.",
    icon: "/icons/icon-192.svg",
    badge: "/icons/icon-192.svg",
    actions:
      data.occurrenceId && data.userId
        ? [
            { action: "complete", title: "Concluir" },
            { action: "ignore", title: "Ignorar" },
          ]
        : [],
    data: {
      notificationId,
      channel: data.channel || "desktop",
      occurrenceId: data.occurrenceId || null,
      url: data.url || "/dashboard",
      userId: data.userId || null,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclose", () => undefined);

self.addEventListener("sync", (event) => {
  if (event.tag !== "taskmanager-offline-sync") {
    return;
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) =>
      Promise.all(
        clients.map((client) =>
          client.postMessage({
            type: "taskmanager-sync-request",
          }),
        ),
      ),
    ),
  );
});

async function handleOccurrenceNotificationAction(notification, action) {
  const occurrenceId = notification.data?.occurrenceId;
  const userId = notification.data?.userId;

  if (!occurrenceId || !userId || (action !== "complete" && action !== "ignore")) {
    return;
  }

  await fetch(`/api/occurrences/${occurrenceId}/${action}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId }),
  });
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "complete" || event.action === "ignore") {
    event.waitUntil(handleOccurrenceNotificationAction(event.notification, event.action));
    return;
  }

  const targetUrl = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const matchingClient = clients.find((client) => client.url.includes(targetUrl));

      if (matchingClient) {
        matchingClient.focus();
        return undefined;
      }

      return self.clients.openWindow(targetUrl);
    }),
  );
});

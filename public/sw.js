const STATIC_CACHE = "taskmanager-static-v1";
const STATIC_ASSETS = ["/manifest.webmanifest", "/icons/icon-192.svg", "/icons/icon-512.svg"];

function createNotificationId(prefix = "desktop") {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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
          .filter((key) => key !== STATIC_CACHE)
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
  const isStaticAsset =
    requestUrl.pathname.startsWith("/_next/static/") ||
    requestUrl.pathname.startsWith("/icons/") ||
    requestUrl.pathname === "/manifest.webmanifest";

  if (!isStaticAsset) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((response) => {
          const responseClone = response.clone();

          caches.open(STATIC_CACHE).then((cache) => {
            cache.put(event.request, responseClone).catch(() => undefined);
          });

          return response;
        })
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
    data: {
      notificationId,
      channel: data.channel || "desktop",
      url: data.url || "/dashboard",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

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

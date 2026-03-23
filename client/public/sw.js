const CACHE_NAME = "brc-v1";
const PRECACHE_URLS = ["/", "/manifest.json", "/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

// Network-first: try network, fall back to cache
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Skip non-GET and WebSocket/API requests
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/ws")) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful responses
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request)),
  );
});

// Bell notification via postMessage
self.addEventListener("message", (event) => {
  if (event.data?.type === "BELL_NOTIFICATION") {
    self.registration.showNotification(event.data.title ?? "brc", {
      body: event.data.body ?? "Terminal bell",
      icon: "/icon-192.png",
      tag: "bell",
      renotify: true,
    });
  }
});

// Notification click → focus app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      if (clients.length > 0) {
        clients[0].focus();
      } else {
        self.clients.openWindow("/");
      }
    }),
  );
});

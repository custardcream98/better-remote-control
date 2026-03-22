self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("message", (event) => {
  if (event.data?.type === "BELL_NOTIFICATION") {
    self.registration.showNotification(event.data.title ?? "brc", {
      body: event.data.body ?? "Terminal bell",
      icon: "/favicon.svg",
      tag: "bell",
      renotify: true,
    });
  }
});

// 알림 클릭 시 앱으로 포커스
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

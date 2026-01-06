self.addEventListener("push", (event) => {
  if (!event.data) return;

  // Be tolerant of non-JSON payloads (e.g. plain text test pushes).
  let payload = { title: "Daily reminder", body: "Tap to log today’s answers.", data: {} };
  try {
    payload = { ...payload, ...event.data.json() };
  } catch (_) {
    const text = event.data.text();
    payload = { ...payload, body: text || payload.body };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      data: payload.data,
      icon: "/favicon.ico",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/journal";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
      return undefined;
    }),
  );
});

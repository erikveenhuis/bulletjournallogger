// Install event - ensure service worker is activated
self.addEventListener("install", () => {
  // Force activation of new service worker immediately
  self.skipWaiting();
});

// Activate event - clean up old caches and ensure service worker is active
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      // Take control of all pages immediately
      self.clients.claim(),
      // Clean up old caches if needed (for future cache management)
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => Promise.resolve(cacheName)),
        );
      }),
    ]),
  );
});

// Push event - handle incoming push notifications
self.addEventListener("push", (event) => {
  if (!event.data) {
    console.warn("Push event received without data");
    return;
  }

  // Be tolerant of non-JSON payloads (e.g. plain text test pushes).
  let payload = { title: "Daily reminder", body: "Tap to log today's answers.", data: {} };
  try {
    payload = { ...payload, ...event.data.json() };
  } catch (error) {
    console.warn("Failed to parse push payload as JSON, using text:", error);
    try {
      const text = event.data.text();
      payload = { ...payload, body: text || payload.body };
    } catch (textError) {
      console.error("Failed to parse push payload:", textError);
      // Use default payload
    }
  }

  event.waitUntil(
    self.registration
      .showNotification(payload.title, {
        body: payload.body,
        data: payload.data,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        tag: "daily-reminder", // Tag prevents duplicate notifications
        requireInteraction: false,
        silent: false,
      })
      .catch((error) => {
        console.error("Failed to show notification:", error);
      }),
  );
});

// Notification click event - handle user clicking on notification
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/journal";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Try to focus an existing window
        for (const client of clientList) {
          if ("focus" in client && "navigate" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        // If no window is open, open a new one
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
        return undefined;
      })
      .catch((error) => {
        console.error("Failed to handle notification click:", error);
      }),
  );
});

// Error handling - log errors for debugging
self.addEventListener("error", (event) => {
  console.error("Service worker error:", event.error);
});

self.addEventListener("unhandledrejection", (event) => {
  console.error("Service worker unhandled rejection:", event.reason);
});

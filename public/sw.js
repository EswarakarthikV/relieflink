// ReliefLink Service Worker — Mobile Push & Offline Shell
const CACHE_NAME = 'relieflink-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/favicon.png',
  '/icons/relieflink-logo.png'
];

// Install Event — cache critical static shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('[SW] Cache addAll warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate Event — take immediate control and clear old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Push Event — receive and render mobile push notifications
self.addEventListener('push', (event) => {
  let payload = {
    title: 'ReliefLink Alert',
    body: 'New urgent disaster relief update.',
    url: '/alerts',
    tag: 'relieflink-alert'
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    } catch {
      payload.body = event.data.text() || payload.body;
    }
  }

  const notificationTitle = payload.title || 'ReliefLink Alert';
  const notificationOptions = {
    body: payload.body || 'New humanitarian supply update.',
    icon: payload.icon || '/icons/icon-192.png',
    badge: payload.badge || '/icons/favicon.png',
    tag: payload.tag || 'relieflink-general-alert',
    renotify: true,
    requireInteraction: false,
    vibrate: [200, 100, 200],
    data: {
      url: payload.url || '/alerts',
      id: payload.id || null,
      timestamp: Date.now()
    },
    actions: [
      { action: 'open', title: 'View Update' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(notificationTitle, notificationOptions)
  );
});

// Notification Click Event — navigate to target URL
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) || '/alerts';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and navigate
      for (const client of clientList) {
        if ('focus' in client) {
          if (client.url.includes(self.location.origin)) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Message listener for client coordination and direct test triggers
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_TEST_NOTIFICATION') {
    const payload = event.data.payload || {};
    self.registration.showNotification(payload.title || 'ReliefLink Test Alert', {
      body: payload.body || 'Push notifications are active and working on this device.',
      icon: '/icons/icon-192.png',
      badge: '/icons/favicon.png',
      tag: 'relieflink-test',
      renotify: true,
      vibrate: [200, 100, 200],
      data: {
        url: payload.url || '/alerts'
      },
      actions: [
        { action: 'open', title: 'Open ReliefLink' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    });
  } else if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

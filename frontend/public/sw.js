/**
 * Subvoy Service Worker
 *
 * Strategy:
 *   - Static assets (JS, CSS, fonts, images): Cache-first with network fallback
 *   - API requests (/api, /auth, /wallet, etc.): Network-first with no cache
 *   - Navigation (HTML pages): Network-first, fallback to offline.html
 */

const CACHE_NAME    = 'subvoy-v1';
const OFFLINE_URL   = '/offline.html';

// Assets to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/offline.html',
];

// ── Install ───────────────────────────────────────────────────────────────────

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
  );
  // Activate immediately — don't wait for old SW to expire
  self.skipWaiting();
});

// ── Activate ──────────────────────────────────────────────────────────────────

self.addEventListener('activate', event => {
  // Delete old caches
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  // Take control of all pages immediately
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin and GET requests
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // API calls → network-only (never cache authenticated data)
  const apiPaths = ['/auth', '/wallet', '/subscriptions', '/notifications',
                    '/analytics', '/imports', '/categories', '/fx', '/webhook'];
  if (apiPaths.some(p => url.pathname.startsWith(p))) {
    event.respondWith(fetch(request));
    return;
  }

  // Navigation requests → network-first, fallback to offline page
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // Static assets → cache-first, update in background (stale-while-revalidate)
  event.respondWith(
    caches.match(request).then(cached => {
      const networkFetch = fetch(request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      });
      return cached ?? networkFetch;
    })
  );
});

// ── Push notifications ────────────────────────────────────────────────────────

self.addEventListener('push', event => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Subvoy', body: event.data.text() };
  }

  const options = {
    body:              payload.body ?? '',
    icon:              '/icons/icon-192.png',
    badge:             '/icons/icon-72.png',
    tag:               payload.tag ?? 'subvoy-notification',
    renotify:          payload.renotify ?? false,
    requireInteraction: payload.requireInteraction ?? false,
    data:              { url: payload.url ?? '/' },
    actions:           payload.actions ?? [],
  };

  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'Subvoy', options)
  );
});

// ── Notification click ────────────────────────────────────────────────────────

self.addEventListener('notificationclick', event => {
  event.notification.close();

  const targetUrl = event.notification.data?.url ?? '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // Focus an existing window if open
      const existing = clients.find(c => c.url.includes(self.location.origin));
      if (existing) {
        existing.focus();
        existing.navigate(targetUrl);
      } else {
        self.clients.openWindow(targetUrl);
      }
    })
  );
});

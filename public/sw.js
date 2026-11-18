self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open('uce-app-shell-v2');
    await Promise.all(['/','/manifest.json','/icons/icon-192.png','/icons/icon-512.png']
      .map((url) => cache.add(url).catch(() => null)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith('uce-app-') && key !== 'uce-app-shell-v2' && key !== 'uce-app-assets-v2')
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open('uce-app-shell-v2');
      try {
        const response = await fetch(request);
        if (response.ok) {
          await cache.put(request, response.clone());
          await cache.put('/', response.clone());
        }
        return response;
      } catch {
        return await cache.match(request) || await cache.match('/') || Response.error();
      }
    })());
    return;
  }

  const isAppAsset = request.destination && ['script','style','image','font','worker'].includes(request.destination);
  if (!isAppAsset) return;
  event.respondWith((async () => {
    const cache = await caches.open('uce-app-assets-v2');
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') await cache.put(request, response.clone());
      return response;
    } catch {
      return cached || Response.error();
    }
  })());
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data?.text() || '' };
  }

  event.waitUntil(self.registration.showNotification(payload.title || 'UCE Connect', {
    body: payload.body || 'Une nouvelle annonce de l’église est disponible.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: payload.url || '/' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const target = new URL(event.notification.data?.url || '/', self.location.origin);
    if (!['http:', 'https:'].includes(target.protocol)) return;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find((client) => new URL(client.url).origin === target.origin);
    if (existing) {
      await existing.navigate(target.href);
      await existing.focus();
    } else {
      await self.clients.openWindow(target.href);
    }
  })());
});

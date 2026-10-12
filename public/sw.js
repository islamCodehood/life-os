const STATIC_CACHE = 'life-os-shell-v1';
const APP_SHELL = ['/en', '/ar'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const localeFallback = url.pathname.startsWith('/ar') ? '/ar' : '/en';
        return (await caches.match(localeFallback)) ?? Response.error();
      }),
    );
    return;
  }

  event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request)));
});

/* Push carries only generic copy and an allowlisted in-app route. */
self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let payload = {};
    try { payload = event.data ? event.data.json() : {}; } catch { payload = {}; }
    const title = typeof payload.title === 'string' && payload.title.length < 90
      ? payload.title : 'Life OS';
    const body = typeof payload.body === 'string' && payload.body.length < 200
      ? payload.body : 'Open Life OS when it suits you.';
    const path = typeof payload.path === 'string' &&
      /^\/(en|ar)\/(child|parent)$/.test(payload.path) ? payload.path : '/en';
    await self.registration.showNotification(title, {
      body, tag: 'life-os-gentle-reminder', data: {path}, icon:'/icons/icon-192.png',
    });
  })());
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const path = event.notification.data && event.notification.data.path;
    const destination = typeof path === 'string' && /^\/(en|ar)\/(child|parent)$/.test(path)
      ? path : '/en';
    const all = await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const open = all.find(client => new URL(client.url).origin === self.location.origin);
    if (open) { await open.focus(); await open.navigate(destination); }
    else { await self.clients.openWindow(destination); }
  })());
});

const CACHE_NAME = 'life-dashboard-v8';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './data.js',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './world-map.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Stale-while-revalidate: 先返回缓存（秒开），后台静默更新缓存，下次打开即为最新版
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(e.request);
      const network = fetch(e.request).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          cache.put(e.request, response.clone());
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    })
  );
});

// Service worker: офлайн-режим.
// ВЕРСИЯ: при каждом выпуске менять число ниже, иначе телефон покажет старую версию из кэша.
const VERSION = 'v4';
const CORE = `clf-core-${VERSION}`;
const RUNTIME = `clf-run-${VERSION}`;

// Всё, что нужно для запуска приложения. Движок распознавания (vendor/) большой и кэшируется
// при первом использовании или кнопкой «Подготовить для работы без интернета» в настройках.
const CORE_FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/store.js', 'js/db.js', 'js/util.js', 'js/categories.js', 'js/classifier.js',
  'js/dictionary.js', 'js/grain.js', 'js/icons.js', 'js/sync.js', 'js/firebase-config.js', 'js/ocr.js', 'js/parser.js',
  'js/views/home.js', 'js/views/ops.js', 'js/views/add.js', 'js/views/settings.js',
  'assets/icon-180.png', 'assets/icon-192.png', 'assets/icon-512.png', 'assets/cat.png', 'assets/splash.jpg',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CORE).then(c => c.addAll(CORE_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) {
      if (k !== CORE && k !== RUNTIME && k.startsWith('clf-')) await caches.delete(k);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Тяжёлое и неизменное (движок, языки, картинки): сначала кэш.
  if (/\/(vendor|assets)\//.test(url.pathname)) {
    e.respondWith(cacheFirst(req));
    return;
  }
  // Файлы приложения: сразу из кэша, а свежую версию тихо подтягиваем (появится при следующем запуске).
  e.respondWith(staleWhileRevalidate(req));
});

async function cacheFirst(req) {
  const hit = await caches.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) (await caches.open(RUNTIME)).put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CORE);
  const hit = await cache.match(req, { ignoreSearch: true });
  const fresh = fetch(req).then(res => {
    if (res.ok) cache.put(req, res.clone());
    return res;
  }).catch(() => null);
  if (hit) { fresh.catch(() => {}); return hit; }
  const res = await fresh;
  if (res) return res;
  // нет сети и нет в кэше: для переходов отдаём главную
  if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
  return Response.error();
}

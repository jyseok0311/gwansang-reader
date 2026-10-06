// 운명 판독기 서비스 워커
// - 앱 파일: 네트워크 우선 (수정 사항이 바로 반영되고, 오프라인이면 캐시 사용)
// - vendor/ 엔진·모델, 아이콘, 웹폰트: 캐시 우선 (용량이 커서 한 번만 내려받음)
const VERSION = 'v26';
const APP_CACHE = `gwansang-app-${VERSION}`;
const ASSET_CACHE = 'gwansang-assets-mp0.10.14';   // 엔진·모델은 MediaPipe 버전이 바뀔 때만 새로 받음
const APP_SHELL = ['./', 'index.html', 'style.css', 'app.js', 'util.js', 'measure.js', 'perspective.js', 'physiognomy.js', 'saju.js', 'palm.js', 'palm-runner.js', 'palm-worker.js', 'palm-reading.js', 'face-guide.js', 'fusion.js', 'views-combo.js', 'views-extra.js', 'fortune-time.js', 'biorhythm.js', 'animal-face.js', 'match.js', 'tarot.js', 'mbti.js', 'report.js', 'views-report.js', 'embers.js', 'charts.js', 'manifest.webmanifest', 'icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(APP_CACHE).then(c => c.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keep = new Set([APP_CACHE, ASSET_CACHE]);
    for (const k of await caches.keys()) if (!keep.has(k)) await caches.delete(k);
    // 예전에는 아이콘도 '엔진·모델' 캐시에 들어 있어 새 아이콘으로 바뀌지 않았다. 옛 아이콘만 골라 지운다.
    try { const c = await caches.open(ASSET_CACHE); for (const r of await c.keys()) if (new URL(r.url).pathname.includes('/icons/')) await c.delete(r); } catch { /* 무시 */ }
    await self.clients.claim();
  })());
});

function isAsset(url) {
  return url.pathname.includes('/vendor/')
    || url.host === 'fonts.googleapis.com' || url.host === 'fonts.gstatic.com';
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.endsWith('/api/info')) return;
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !isAsset(url)) return;

  if (isAsset(url)) {
    e.respondWith((async () => {
      const cache = await caches.open(ASSET_CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
      return res;
    })());
    return;
  }

  e.respondWith((async () => {
    const cache = await caches.open(APP_CACHE);
    const cached = await cache.match(req, { ignoreSearch: true }) || (req.mode === 'navigate' ? await cache.match('index.html') : null);
    const network = fetch(req).then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    });
    e.waitUntil(network.then(() => {}, () => {}));   // 캐시로 먼저 응답해도 갱신은 끝까지 진행
    if (!cached) return network;
    // 캐시가 있으면 네트워크를 최대 3초만 기다린다 (느린 모바일망에서 흰 화면 방지)
    return Promise.race([
      network.catch(() => cached),
      new Promise((resolve) => setTimeout(() => resolve(cached), 3000)),
    ]);
  })());
});

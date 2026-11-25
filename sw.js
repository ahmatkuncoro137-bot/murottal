const CACHE = 'murottal-v3';
const PRECACHE = [
  "./",
  "./assets/azan/azan-adam-synagda.mp3",
  "./assets/azan/azan-madinah-nabawi.mp3",
  "./assets/azan/azan-makkah-haram.mp3",
  "./assets/azan/azan-makkah-maghrib.mp3",
  "./assets/azan/azan-sabah-fakhri.mp3",
  "./assets/azan/azan-shalqar.mp3",
  "./assets/azan/azan-subuh-malmo.mp3",
  "./assets/fonts/CinzelDecorative-Bold.ttf",
  "./assets/fonts/CinzelDecorative-Regular.ttf",
  "./assets/fonts/NotoNaskhArabic.ttf",
  "./assets/fonts/PlusJakartaSans.ttf",
  "./assets/icons/apple-touch-icon.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-512.png",
  "./assets/palm-icon.png",
  "./assets/palm.png",
  "./css/app.css",
  "./data/azan.json",
  "./data/cities.json",
  "./data/doa-harian.json",
  "./data/doa-quran.json",
  "./data/reciters.json",
  "./data/surahs.json",
  "./index.html",
  "./js/alarm.js",
  "./js/app.js",
  "./js/doa.js",
  "./js/murotal.js",
  "./js/prayer.js",
  "./js/qibla.js",
  "./js/util.js",
  "./js/vendor/adhan.LICENSE",
  "./js/vendor/adhan.esm.js",
  "./js/vendor/adhan.umd.min.js",
  "./manifest.json"
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    for (const url of PRECACHE) {
      try { await cache.add(url); } catch (err) { /* skip missing */ }
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k !== CACHE && k !== 'murottal-offline-v1')
        .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Serve downloaded offline surah audio/API from murottal-offline-v1 when available
  if (url.origin !== self.location.origin) {
    if (url.hostname === 'cdn.equran.id' || url.hostname === 'equran.id') {
      event.respondWith((async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        return fetch(req);
      })());
    }
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res && res.ok) {
        const cache = await caches.open(CACHE);
        cache.put(req, res.clone());
      }
      return res;
    } catch (err) {
      if (cached) return cached;
      if (req.mode === 'navigate') return caches.match('./index.html');
      throw err;
    }
  })());
});

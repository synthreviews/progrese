/* Service worker pro Progrese (PWA shell).
   - "network-first" pro HTML stránky (navigace) — online se vždy natáhne
     nejčerstvější verze, offline naskočí poslední uložená verze z cache.
   - "cache-first" pro statické soubory (ikony, manifesty, VexFlow/jsPDF
     z CDN) — jsou to věci, co se nemění při každém deployi, takže je
     zbytečné je pořád stahovat znovu.
   - Verze cache (CACHE_VERSION) se zvedne při každé větší změně app shellu;
     activate pak smaže staré verze, aby se cache nehromadila donekonečna.
   - Cesty jsou relativní ke scope '/progrese/' (viz umístění sw.js), aby
     se tenhle SW nikdy nehádal s jinou appkou na jiné cestě téhož originu.
*/
const CACHE_VERSION = 'progrese-v3';

const APP_SHELL = [
  '/progrese/',
  '/progrese/index.html',
  '/progrese/progrese-en.html',
  '/progrese/progrese-cz.html',
  '/progrese/manifest-progrese-en.json',
  '/progrese/manifest-progrese-cz.json',
  '/progrese/progrese-favicon.ico',
  '/progrese/progrese-favicon.svg',
  '/progrese/progrese-apple-touch-icon.png',
  '/progrese/progrese-icon-96.png',
  '/progrese/progrese-icon-128.png',
  '/progrese/progrese-icon-144.png',
  '/progrese/progrese-icon-192.png',
  '/progrese/progrese-icon-256.png',
  '/progrese/progrese-icon-384.png',
  '/progrese/progrese-icon-512.png',
  '/progrese/progrese-icon-192-maskable.png',
  '/progrese/progrese-icon-512-maskable.png',
  'https://cdn.jsdelivr.net/npm/vexflow@4.2.2/build/cjs/vexflow.js',
  'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    // Každý soubor zvlášť s vlastním try/catch — cache.addAll() by jinak
    // celou instalaci shodil kvůli jedinému chybějícímu/404 souboru
    // (třeba favicon, který ještě nemusí být na serveru nahraný).
    await Promise.all(APP_SHELL.map(async (url) => {
      try {
        await cache.add(url);
      } catch (err) {
        console.warn('[progrese sw] nepodařilo se přednačíst', url, err);
      }
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // POST apod. necháváme na prohlížeči beze změny

  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req));
  } else {
    event.respondWith(cacheFirst(req));
  }
});

async function networkFirst(req) {
  try {
    const fresh = await fetch(req);
    const cache = await caches.open(CACHE_VERSION);
    cache.put(req, fresh.clone());
    return fresh;
  } catch (err) {
    const cached = await caches.match(req);
    if (cached) return cached;
    const fallback = await caches.match('/progrese/progrese-en.html');
    return fallback || new Response(
      'Offline a tahle stránka ještě není uložená v cache.',
      { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
    );
  }
}

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.status === 200) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(req, fresh.clone());
    }
    return fresh;
  } catch (err) {
    return cached || Response.error();
  }
}

// ─── Update versi cache setiap ada perubahan file ───────────────
const CACHE_NAME = 'kas-pemuda-v3';
const ASSETS = [
    '/',
    '/index.html',
    '/dashboard.html',
    '/history.html',
    '/manifest.json',
    '/css/style.css',
    '/css/responsive.css',
    '/js/auth.js',
    '/js/utils.js',
    '/js/dashboard.js',
    '/js/history.js',
    '/js/firebase-config.js',
    '/js/transactions.js',
    '/assets/images/apple-touch-icon.png',
    '/assets/images/favicon-32x32.png',
    '/assets/images/favicon-16x16.png',
    '/assets/images/favicon.ico',
    '/assets/images/android-chrome-192x192.png',
    '/assets/images/android-chrome-512x512.png',
    '/assets/images/logo.webp'
];

// Install — cache semua aset
self.addEventListener('install', (e) => {
    self.skipWaiting(); // langsung aktif tanpa nunggu tab lama tutup
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

// Activate — hapus cache lama, ambil kendali semua tab
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

// Fetch — Network First: utamakan network, fallback ke cache
self.addEventListener('fetch', (e) => {
    // Lewati request non-GET dan resource eksternal (Firebase, CDN, dll)
    if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) {
        return;
    }

    e.respondWith(
        fetch(e.request)
            .then((response) => {
                // Simpan response terbaru ke cache
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(e.request, responseClone);
                });
                return response;
            })
            .catch(() => {
                // Kalau offline, sajikan dari cache
                return caches.match(e.request);
            })
    );
});

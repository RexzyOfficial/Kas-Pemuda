const CACHE_NAME = 'kas-pemuda-v2';
const ASSETS = [
    '/',
    '/index.html',
    '/dashboard.html',
    '/history.html',
    '/css/style.css',
    '/css/responsive.css',
    '/js/auth.js',
    '/js/utils.js',
    '/js/dashboard.js',
    '/js/history.js',
    '/assets/images/apple-touch-icon.png',
    '/assets/images/favicon-32x32.png',
    '/assets/images/favicon-16x16.png',
    '/assets/images/favicon.ico',
    '/assets/images/android-chrome-192x192.png',
    '/assets/images/android-chrome-512x512.png',
    '/assets/images/logo.webp'
];

// Install Service Worker
self.addEventListener('install', (e) => {
    // Force the waiting service worker to become the active service worker.
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

// Activate Service Worker
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        })
    );
    // Control all open clients
    self.clients.claim();
});

// Fetch Assets - Network First Strategy
self.addEventListener('fetch', (e) => {
    // Skip for non-GET requests or external resources
    if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) {
        return;
    }

    e.respondWith(
        fetch(e.request)
            .then((response) => {
                // Clone the response and save to cache
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(e.request, responseClone);
                });
                return response;
            })
            .catch(() => {
                // If network fails, serve from cache
                return caches.match(e.request);
            })
    );
});

// KiranaBook Service Worker v3
// Handles offline caching for the PWA

const CACHE = 'kiranabook-v3';

const CACHE_URLS = [
  './',
  './index.html',
  './kirana-inventory-updated.html',
  'https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;600;700;800&family=Noto+Sans:wght@400;500;600&display=swap',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js'
];

// Install: pre-cache app files
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return Promise.allSettled(
        CACHE_URLS.map(function(url) {
          return cache.add(url).catch(function() {});
        })
      );
    })
  );
  self.skipWaiting();
});

// Activate: remove old caches
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// Fetch: serve from cache, fallback to network
self.addEventListener('fetch', function(e) {
  var url = e.request.url;

  // Never intercept Firebase real-time DB or Google OAuth calls
  if (url.includes('firebaseio.com') ||
      url.includes('firebasedatabase.app') ||
      url.includes('googleapis.com/identitytoolkit') ||
      url.includes('securetoken.googleapis.com') ||
      url.includes('accounts.google.com') ||
      url.includes('oauth2.googleapis.com') ||
      url.includes('/upload/drive/') ||
      url.includes('/drive/v3/files')) {
    return; // Pass through to network
  }

  // Fonts & Firebase SDK — cache first, update in background
  if (url.includes('fonts.googleapis.com') ||
      url.includes('fonts.gstatic.com') ||
      url.includes('gstatic.com/firebasejs')) {
    e.respondWith(
      caches.open(CACHE).then(function(cache) {
        return cache.match(e.request).then(function(cached) {
          var networkFetch = fetch(e.request).then(function(r) {
            if (r && r.status === 200) cache.put(e.request, r.clone());
            return r;
          }).catch(function() { return cached; });
          return cached || networkFetch;
        });
      })
    );
    return;
  }

  // App HTML files — stale-while-revalidate
  if (e.request.mode === 'navigate' ||
      url.endsWith('.html') ||
      url.endsWith('/')) {
    e.respondWith(
      caches.open(CACHE).then(function(cache) {
        return cache.match(e.request).then(function(cached) {
          var networkFetch = fetch(e.request).then(function(r) {
            if (r && r.status === 200) cache.put(e.request, r.clone());
            return r;
          }).catch(function() {
            return cached || caches.match('./kirana-inventory-updated.html');
          });
          return cached || networkFetch;
        });
      })
    );
    return;
  }
});

const CACHE_NAME = "voktest-v27";
const APP_SCOPE_URL = new URL(self.registration.scope);
const APP_SCOPE_PATH = normalizeScopePath(APP_SCOPE_URL.pathname);
const APP_INDEX_URL = new URL("index.html", APP_SCOPE_URL).toString();
const ASSETS = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "modules/common.js",
  "modules/catalog-utils.js",
  "modules/admin-utils.js",
  "modules/history-module.js",
  "modules/import-module.js",
  "data/vocabulary.js",
  "data/vocabulary-fr6.js",
  "data/vocabulary-la6.js",
  "data/conjugations.js",
  "assets/language-king-banner.png",
  "manifest.webmanifest",
  "icons/icon.svg"
].map((path) => new URL(path, APP_SCOPE_URL).toString());

function normalizeScopePath(pathname) {
  const raw = typeof pathname === "string" && pathname.trim() ? pathname.trim() : "/";
  const withLeadingSlash = raw.startsWith("/") ? raw : `/${raw}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}

function getScopeRelativePath(url) {
  if (url.origin !== self.location.origin) {
    return null;
  }
  if (!url.pathname.startsWith(APP_SCOPE_PATH)) {
    return null;
  }
  return url.pathname.slice(APP_SCOPE_PATH.length);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
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

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);
  const sameOrigin = url.origin === self.location.origin;
  const scopeRelativePath = sameOrigin ? getScopeRelativePath(url) : null;
  const isApiRequest = scopeRelativePath !== null && scopeRelativePath.startsWith("api/");

  if (isApiRequest) {
    event.respondWith(fetch(event.request));
    return;
  }

  const isAppShell =
    scopeRelativePath !== null &&
    (
      scopeRelativePath === "" ||
      scopeRelativePath.endsWith("/") ||
      scopeRelativePath.endsWith(".html") ||
      scopeRelativePath.endsWith(".js") ||
      scopeRelativePath.endsWith(".css") ||
      scopeRelativePath.endsWith(".webmanifest")
    );

  if (isAppShell) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, copy);
            });
          }
          return response;
        })
        .catch(() =>
          caches.match(event.request).then((cached) => cached || caches.match(APP_INDEX_URL))
        )
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(event.request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, copy);
          });
        }
        return response;
      });
    })
  );
});

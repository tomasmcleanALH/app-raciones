// Service worker muy simple: permite que la app abra aunque no haya señal,
// mostrando la última versión que se haya visitado con conexión.
// Los datos (entregas) NO se cachean acá; eso lo maneja IndexedDB
// (ver src/lib/offline). Esto sólo cachea el "cascarón" de la app.

const CACHE_NAME = "app-raciones-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Sólo nos metemos con GET del mismo origen (páginas, JS, CSS, íconos).
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  // Nunca cachear llamadas a la API de Supabase ni rutas /api.
  if (request.url.includes("supabase.co") || request.url.includes("/api/")) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copia = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copia));
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match("/"))),
  );
});

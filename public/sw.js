// Service worker muy simple: permite que la app abra aunque no haya señal,
// mostrando la última versión que se haya visitado con conexión.
// Los datos (entregas) NO se cachean acá; eso lo maneja IndexedDB
// (ver src/lib/offline). Esto sólo cachea el "cascarón" de la app.

// v2: se sube de versión a propósito para tirar el cache viejo (podía
// tener guardada, para páginas a las que sólo se llegaba con el router
// de Next, una version incompleta que después se servía sin señal; ver
// ElegirCampoTiles/ElegirModuloTiles).
const CACHE_NAME = "app-raciones-v2";

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
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;

        // Sin señal y sin una copia guardada de ESTA pantalla puntual (p.
        // ej. nunca se abrió antes con conexión). Antes acá cualquier
        // pantalla navegable caía en "/", que a veces terminaba mostrando
        // una completamente distinta (la de elegir campo) sin avisar.
        // Mejor un aviso claro que una pantalla equivocada en silencio.
        if (request.mode === "navigate") {
          return new Response(
            "<!doctype html><meta charset='utf-8'>" +
              "<meta name='viewport' content='width=device-width, initial-scale=1'>" +
              "<body style='font-family:sans-serif;padding:2rem;text-align:center;color:#57534e'>" +
              "<p>Sin conexión: esta pantalla todavía no se guardó en el celular.<br>Conectate una vez y volvé a intentar.</p>" +
              "</body>",
            { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
          );
        }
        return caches.match("/");
      }),
  );
});

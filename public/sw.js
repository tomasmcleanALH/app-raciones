// Service worker: permite que la app abra aunque no haya señal (o la señal sea muy mala),
// mostrando la última versión de cada pantalla que se haya visitado con conexión.
// Los datos (entregas, movimientos, catálogos) NO se cachean acá; eso lo manejan
// IndexedDB y localStorage (ver src/lib/offline). Esto sólo cachea el "cascarón".
//
// Dos cachés:
// - estáticos: archivos /_next/static/* (el nombre trae un hash, nunca cambian): primero caché.
// - pantallas: sólo el HTML completo de cada pantalla (navegaciones): primero red con un
//   tiempo máximo y, si falla o tarda, la copia guardada. NO se guardan las respuestas
//   internas de Next (RSC): pisaban al HTML y sin señal aparecía código en pantalla.
//
// v3: se sube de versión para tirar los cachés viejos (guardaban de todo, RSC incluido).
const PREFIJO = "app-operaciones-v3";
const CACHE_ESTATICOS = `${PREFIJO}-estaticos`;
const CACHE_PANTALLAS = `${PREFIJO}-pantallas`;

// Si la red no responde en este tiempo se usa la copia guardada (señal mala).
const TOPE_PANTALLA_MS = 6000;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const claves = await caches.keys();
      await Promise.all(
        claves.filter((k) => k !== CACHE_ESTATICOS && k !== CACHE_PANTALLAS).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

function respuestaSinCopia() {
  return new Response(
    "<!doctype html><meta charset='utf-8'>" +
      "<meta name='viewport' content='width=device-width, initial-scale=1'>" +
      "<body style='font-family:sans-serif;padding:2rem;text-align:center;color:#57534e'>" +
      "<p>Sin conexión: esta pantalla todavía no se guardó en el celular.<br>Conectate una vez y volvé a intentar.</p>" +
      "</body>",
    { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

// Pantallas: red con tope de tiempo; si no llega a tiempo, la copia. El pedido a la red
// sigue en segundo plano y, si termina bien, actualiza la copia para la próxima vez.
async function pantalla(event) {
  const { request } = event;
  const cache = await caches.open(CACHE_PANTALLAS);

  const red = fetch(request).then(async (respuesta) => {
    // Las redirecciones (p. ej. a /login) no se guardan bajo la dirección pedida.
    if (respuesta.ok && !respuesta.redirected) {
      await cache.put(request, respuesta.clone());
    }
    return respuesta;
  });
  event.waitUntil(red.catch(() => {}));

  const tope = new Promise((resolve) => setTimeout(() => resolve(null), TOPE_PANTALLA_MS));

  try {
    const respuesta = await Promise.race([red, tope]);
    if (respuesta) return respuesta;
  } catch {
    // Sin conexión: se sigue con la copia.
  }

  const copia = await cache.match(request);
  if (copia) return copia;

  // Se agotó el tiempo y no hay copia: se espera a la red lo que haga falta.
  try {
    return await red;
  } catch {
    return respuestaSinCopia();
  }
}

async function estatico(request) {
  const cache = await caches.open(CACHE_ESTATICOS);
  const copia = await cache.match(request);
  if (copia) return copia;
  const respuesta = await fetch(request);
  if (respuesta.ok) await cache.put(request, respuesta.clone());
  return respuesta;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Sólo GET del mismo origen. Nunca Supabase ni /api.
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(estatico(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(pantalla(event));
  }
  // Todo lo demás (incluidas las respuestas internas RSC de Next) va directo a la red.
});

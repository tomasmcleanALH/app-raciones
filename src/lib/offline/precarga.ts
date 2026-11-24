import {
  getAlimentosActivos,
  getBolsonesActivos,
  getContratistasActivos,
  getLotesActivos,
  getLotesMaterialesActivos,
  getMaterialesActivos,
  getProveedoresActivos,
  getUbicacionesActivas,
} from "./catalogos";
import { createClient } from "@/lib/supabase/client";
import { conTope } from "./tope";

// Tiene que coincidir con CACHE_PANTALLAS de public/sw.js.
const CACHE_PANTALLAS = "app-operaciones-v3-pantallas";
const CLAVE_ESTADO = "app-operaciones:precarga";
const HEADER_CAMPO_PRECARGA = "x-campo-precarga";
const CADA_MS = 24 * 60 * 60_000;
const TOPE_PEDIDO_MS = 15_000;

type Estado = { fecha: number; build: string; userId: string };
type Fase = "preparando" | "lista" | "error" | null;

let fase: Fase = null;
let corriendo = false;
const oyentes = new Set<() => void>();

function cambiarFase(nueva: Fase) {
  fase = nueva;
  oyentes.forEach((fn) => fn());
}

/** Para mostrar en pantalla si el celular ya está listo para usarse sin señal. */
export function faseDePrecarga(): Fase {
  if (fase) return fase;
  return leerEstado() ? "lista" : null;
}

export function escucharPrecarga(fn: () => void) {
  oyentes.add(fn);
  return () => {
    oyentes.delete(fn);
  };
}

function leerEstado(): Estado | null {
  try {
    const crudo = localStorage.getItem(CLAVE_ESTADO);
    return crudo ? (JSON.parse(crudo) as Estado) : null;
  } catch {
    return null;
  }
}

function guardarEstado(estado: Estado) {
  try {
    localStorage.setItem(CLAVE_ESTADO, JSON.stringify(estado));
  } catch {
    // Sin poder guardar el estado, se vuelve a precargar la próxima vez: no es grave.
  }
}

const BUILD = process.env.NEXT_PUBLIC_BUILD ?? "dev";

/** Pantallas de cargar de un campo. "?c=" no cambia lo que arma el servidor: sólo da una copia por campo. */
function pantallasDelCampo(campoId: string) {
  return ["/", "/elegir-modulo", "/entregar", "/stock/cargar"].map((ruta) => `${ruta}?c=${campoId}`);
}

const RE_ARCHIVOS = /\/_next\/static\/[^"'\\\s)<>]+/g;

async function pedir(url: string, init?: RequestInit) {
  return conTope(fetch(url, init), TOPE_PEDIDO_MS);
}

/** Baja los archivos (código, estilos, letras) que nombra el texto. Pasan por el service worker, que los guarda. */
async function bajarArchivos(texto: string, yaVistos: Set<string>) {
  const nuevos = (texto.match(RE_ARCHIVOS) ?? []).filter((a) => !yaVistos.has(a));
  for (const archivo of nuevos) yaVistos.add(archivo);

  for (const archivo of nuevos) {
    try {
      const r = await pedir(archivo);
      // Los estilos nombran las letras (.woff2): también hay que tenerlas.
      if (r.ok && archivo.split("?")[0].endsWith(".css")) {
        await bajarArchivos(await r.text(), yaVistos);
      }
    } catch {
      // Un archivo que no baja no frena el resto; si hace falta, se baja al usarlo con señal.
    }
  }
}

/** Guarda una pantalla armada por el servidor "como si" se hubiera elegido ese campo. */
async function guardarPantalla(url: string, campoId: string, yaVistos: Set<string>) {
  const r = await pedir(url, { headers: { [HEADER_CAMPO_PRECARGA]: campoId }, cache: "no-store" });
  const destino = new URL(r.url);
  // Sin sesión o con redirección a otro lado que no sirve: no se guarda.
  if (!r.ok || destino.pathname.startsWith("/login")) return;

  const html = await r.text();
  // Copia limpia (sin marca de "redirigida"): sólo así el navegador la acepta como pantalla.
  const copia = new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
  const cache = await caches.open(CACHE_PANTALLAS);
  await cache.put(new URL(url, location.origin).href, copia);

  await bajarArchivos(html, yaVistos);
}

async function esperarServiceWorker() {
  if (!("serviceWorker" in navigator) || !("caches" in window)) return false;
  await conTope(navigator.serviceWorker.ready, 10_000);
  if (!navigator.serviceWorker.controller) {
    // Recién instalado: espera un momento a que tome el control para que guarde los archivos.
    await new Promise<void>((resolve) => {
      const fin = () => resolve();
      navigator.serviceWorker.addEventListener("controllerchange", fin, { once: true });
      setTimeout(fin, 3_000);
    });
  }
  return true;
}

/**
 * Con señal, deja el celular listo para usarse sin señal: guarda las pantallas de cargar de
 * todos los campos del usuario y baja sus catálogos. Se repite una vez por día, al cambiar
 * la versión de la web y cuando entra otra persona en el mismo celular.
 */
export async function precargarSiHaceFalta(forzar = false) {
  if (corriendo || typeof navigator === "undefined" || !navigator.onLine) return;
  corriendo = true;

  try {
    // Revisión barata (sin pedir nada a la red): ¿ya está al día para esta persona y esta versión?
    const previo = leerEstado();
    if (!forzar && previo && previo.build === BUILD && Date.now() - previo.fecha < CADA_MS) {
      const { data } = await conTope(createClient().auth.getSession(), 3_000);
      if (data.session?.user.id === previo.userId) return;
    }

    if (!(await esperarServiceWorker())) return;

    const respuesta = await pedir("/api/precarga", { cache: "no-store" });
    if (!respuesta.ok) return; // sin sesión (login) u otro problema: no hay nada que precargar
    const { userId, campos } = (await respuesta.json()) as { userId: string; campos: string[] };
    if (campos.length === 0) return;

    if (!previo || previo.userId !== userId) cambiarFase("preparando");

    const yaVistos = new Set<string>();
    let fallos = 0;

    for (const campoId of campos) {
      for (const url of pantallasDelCampo(campoId)) {
        try {
          await guardarPantalla(url, campoId, yaVistos);
        } catch {
          fallos += 1;
        }
      }

      const catalogos = await Promise.allSettled([
        getLotesActivos(campoId),
        getAlimentosActivos(campoId),
        getUbicacionesActivas(campoId),
        getBolsonesActivos(campoId),
        getMaterialesActivos(campoId),
        getProveedoresActivos(campoId),
        getContratistasActivos(campoId),
        getLotesMaterialesActivos(campoId),
      ]);
      // Los catálogos de un módulo que el campo no tiene vienen vacíos, no fallan: un fallo es de red.
      fallos += catalogos.filter((c) => c.status === "rejected").length;
    }

    // Si se cortó la señal a mitad de camino, no se da por hecha: se reintenta en la próxima apertura.
    if (fallos > 0) {
      cambiarFase(previo?.userId === userId ? "lista" : "error");
      return;
    }

    guardarEstado({ fecha: Date.now(), build: BUILD, userId });
    cambiarFase("lista");
  } catch {
    cambiarFase(leerEstado() ? "lista" : "error");
  } finally {
    corriendo = false;
  }
}

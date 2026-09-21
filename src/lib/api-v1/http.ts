import { createHash, timingSafeEqual } from "node:crypto";

/**
 * API de solo lectura (/api/v1) para otras webs internas.
 * Este módulo resuelve lo común a todos los endpoints: autenticación por
 * clave secreta, https obligatorio y formato de respuestas y errores.
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    public codigo: string,
    mensaje: string,
    public headers: Record<string, string> = {},
  ) {
    super(mensaje);
  }
}

const HEADERS_BASE = { "Cache-Control": "no-store" };

export function respuestaJson(cuerpo: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(cuerpo, { status, headers: { ...HEADERS_BASE, ...headers } });
}

function respuestaError(e: ApiError) {
  return respuestaJson({ error: { codigo: e.codigo, mensaje: e.message } }, e.status, e.headers);
}

function hash(valor: string) {
  return createHash("sha256").update(valor).digest();
}

/** Compara en tiempo constante (con hashes, así el largo no filtra nada). */
function clavesIguales(a: string, b: string) {
  return timingSafeEqual(hash(a), hash(b));
}

function verificarHttps(request: Request) {
  // En Vercel http ya se redirige a https; esto es una segunda barrera por
  // si algún pedido llegara igual por http. En desarrollo local no aplica.
  if (process.env.NODE_ENV !== "production") return;
  const proto = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  if (proto !== "https") throw new ApiError(400, "https_requerido", "Esta API solo acepta pedidos por https.");
}

function verificarClave(request: Request) {
  // La clave vigente y, opcionalmente, la anterior: así se puede rotar la
  // clave sin cortar a quien consulta (se pone la nueva, se actualiza el
  // consumidor y después se borra la anterior).
  const vigentes = [process.env.API_KEY_LECTURA, process.env.API_KEY_LECTURA_ANTERIOR].filter(
    (k): k is string => !!k && k.length >= 16,
  );
  if (vigentes.length === 0) {
    throw new ApiError(503, "api_no_configurada", "La API no está habilitada en este servidor.");
  }

  const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "");
  if (!match) {
    throw new ApiError(401, "no_autorizado", "Falta el encabezado Authorization: Bearer <clave>.", {
      "WWW-Authenticate": "Bearer",
    });
  }
  if (!vigentes.some((k) => clavesIguales(k, match[1]))) {
    throw new ApiError(401, "clave_invalida", "La clave no es válida.", { "WWW-Authenticate": "Bearer" });
  }
}

/** Envuelve un endpoint GET con https, clave y manejo de errores. */
export function endpointGet(fn: (url: URL) => Promise<unknown>) {
  return async function GET(request: Request) {
    try {
      verificarHttps(request);
      verificarClave(request);
      return respuestaJson(await fn(new URL(request.url)));
    } catch (e) {
      if (e instanceof ApiError) return respuestaError(e);
      console.error("[api/v1]", e);
      return respuestaError(new ApiError(500, "error_interno", "Error interno del servidor."));
    }
  };
}

/** Todo lo que no sea GET se rechaza: la API es de solo lectura. */
export function noPermitido() {
  return respuestaError(
    new ApiError(405, "metodo_no_permitido", "Esta API es de solo lectura: solo acepta GET.", { Allow: "GET" }),
  );
}

// --- Parámetros de la URL -------------------------------------------------

export function paramEnum<T extends string>(url: URL, nombre: string, validos: readonly T[]): T | null {
  const valor = url.searchParams.get(nombre);
  if (valor === null || valor === "") return null;
  if (!(validos as readonly string[]).includes(valor)) {
    throw new ApiError(400, "parametro_invalido", `"${nombre}" debe ser uno de: ${validos.join(", ")}.`);
  }
  return valor as T;
}

export function paramFechaHora(url: URL, nombre: string): string | null {
  const valor = url.searchParams.get(nombre);
  if (valor === null || valor === "") return null;
  // Un "+" sin codificar en la URL llega como espacio: se lo devolvemos.
  const iso = valor.replace(" ", "+");
  const t = Date.parse(iso);
  if (Number.isNaN(t)) {
    throw new ApiError(400, "parametro_invalido", `"${nombre}" debe ser una fecha ISO, ej. 2026-09-21T05:00:00Z.`);
  }
  return new Date(t).toISOString();
}

export function paramLimite(url: URL, porDefecto = 500, maximo = 1000): number {
  const valor = url.searchParams.get("limit");
  if (valor === null || valor === "") return porDefecto;
  const n = Number(valor);
  if (!Number.isInteger(n) || n < 1 || n > maximo) {
    throw new ApiError(400, "parametro_invalido", `"limit" debe ser un entero entre 1 y ${maximo}.`);
  }
  return n;
}

export function paramUuid(url: URL, nombre: string): string | null {
  const valor = url.searchParams.get(nombre);
  if (valor === null || valor === "") return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor)) {
    throw new ApiError(400, "parametro_invalido", `"${nombre}" debe ser un id (uuid).`);
  }
  return valor.toLowerCase();
}

import { TopeAgotadoError } from "./tope";

/** ¿El error es de conexión (no hay señal o no llegó a tiempo) y no un rechazo del servidor? */
export function esFallaDeRed(error: unknown): boolean {
  if (error instanceof TopeAgotadoError) return true;
  const mensaje = typeof error === "object" && error && "message" in error ? String((error as { message: unknown }).message) : "";
  return /failed to fetch|fetch failed|networkerror|network request failed|load failed|timeout|timed out/i.test(mensaje);
}

/** Motivo de un rechazo del servidor, en palabras que entienda quien carga. */
export function explicarRechazo(mensaje: string | undefined): string {
  if (!mensaje) return "No se pudo subir.";
  if (/row-level security|permission denied|42501/i.test(mensaje)) {
    return "No tenés permiso para cargar esto (o tu sesión venció). Entrá de nuevo con señal; si sigue igual, avisale al administrador.";
  }
  if (/jwt|token|expired/i.test(mensaje)) {
    return "Tu sesión venció. Entrá de nuevo con señal y se va a subir.";
  }
  if (/foreign key|23503/i.test(mensaje)) {
    return "El lote, alimento o material de esta carga ya no existe. Si es un error, descartala y cargala de nuevo.";
  }
  return `No se pudo subir: ${mensaje}`;
}

/** Nombre de un lote, alimento, material, etc. a partir de los catálogos guardados en el celular. */
export function nombreGuardado(id: string | null | undefined): string | null {
  if (!id) return null;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const clave = localStorage.key(i);
      if (!clave?.startsWith("app-raciones:cache:")) continue;
      const lista = JSON.parse(localStorage.getItem(clave) ?? "[]") as { id?: string; nombre?: string }[];
      const hallado = Array.isArray(lista) ? lista.find((x) => x.id === id) : undefined;
      if (hallado?.nombre) return hallado.nombre;
    }
  } catch {
    // Sin catálogos legibles se muestra sin nombre: no es grave.
  }
  return null;
}

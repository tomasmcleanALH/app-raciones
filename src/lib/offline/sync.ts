import { createClient } from "@/lib/supabase/client";
import {
  borrarEntregaPendiente,
  listarEntregasPendientes,
  marcarIntentoFallido,
} from "./db";

let sincronizando = false;

/**
 * Intenta subir a Supabase todas las entregas guardadas offline.
 * Usa "client_id" (único) para no duplicar si una entrega ya se
 * había subido pero el celular no llegó a enterarse (p. ej. se
 * cortó la señal justo después de guardar).
 */
export async function sincronizarPendientes(): Promise<{ subidas: number; fallidas: number }> {
  if (sincronizando) return { subidas: 0, fallidas: 0 };
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { subidas: 0, fallidas: 0 };
  }

  sincronizando = true;
  let subidas = 0;
  let fallidas = 0;

  try {
    const supabase = createClient();
    const pendientes = await listarEntregasPendientes();

    for (const entrega of pendientes) {
      const {
        client_id,
        fecha_entrega,
        lote_id,
        alimento_id,
        cantidad,
        unidad,
        ubicacion_id,
        bolson_id,
        observaciones,
        cargado_por,
      } = entrega;

      const { error } = await supabase.from("entregas").upsert(
        {
          client_id,
          fecha_entrega,
          lote_id,
          alimento_id,
          cantidad,
          unidad,
          ubicacion_id,
          bolson_id,
          observaciones,
          cargado_por,
        },
        { onConflict: "client_id", ignoreDuplicates: true },
      );

      if (error) {
        fallidas += 1;
        await marcarIntentoFallido(client_id, error.message);
      } else {
        await borrarEntregaPendiente(client_id);
        subidas += 1;
      }
    }
  } finally {
    sincronizando = false;
  }

  return { subidas, fallidas };
}

type Listener = () => void;
const listeners = new Set<Listener>();

/** Avisa a quien esté escuchando que puede haber cambiado el estado de sincronización. */
export function notificarCambio() {
  listeners.forEach((fn) => fn());
}

export function escucharCambiosDeSync(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Arranca los listeners globales de reconexión. Llamar una sola vez (layout raíz). */
export function iniciarSincronizacionAutomatica() {
  if (typeof window === "undefined") return () => {};

  const intentar = async () => {
    await sincronizarPendientes();
    notificarCambio();
  };

  window.addEventListener("online", intentar);
  // Reintento periódico por si el navegador no dispara "online" de forma confiable.
  const intervalo = setInterval(intentar, 30_000);
  // Primer intento al cargar la app.
  intentar();

  return () => {
    window.removeEventListener("online", intentar);
    clearInterval(intervalo);
  };
}

import { createClient } from "@/lib/supabase/client";
import {
  borrarEntregaPendiente,
  borrarMovimientoPendiente,
  listarEntregasPendientes,
  listarMovimientosPendientes,
  marcarIntentoFallido,
  marcarIntentoMovimientoFallido,
} from "./db";

let sincronizando = false;

async function subirEntregasPendientes(supabase: ReturnType<typeof createClient>) {
  let subidas = 0;
  let fallidas = 0;

  for (const entrega of await listarEntregasPendientes()) {
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
      { client_id, fecha_entrega, lote_id, alimento_id, cantidad, unidad, ubicacion_id, bolson_id, observaciones, cargado_por },
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

  return { subidas, fallidas };
}

async function subirMovimientosPendientes(supabase: ReturnType<typeof createClient>) {
  let subidas = 0;
  let fallidas = 0;

  for (const movimiento of await listarMovimientosPendientes()) {
    const {
      client_id,
      fecha,
      material_id,
      tipo,
      cantidad,
      unidad,
      proveedor_id,
      contratista_id,
      lote_material_id,
      observaciones,
      cargado_por,
    } = movimiento;

    const { error } = await supabase.from("movimientos_stock").upsert(
      { client_id, fecha, material_id, tipo, cantidad, unidad, proveedor_id, contratista_id, lote_material_id, observaciones, cargado_por },
      { onConflict: "client_id", ignoreDuplicates: true },
    );

    if (error) {
      fallidas += 1;
      await marcarIntentoMovimientoFallido(client_id, error.message);
    } else {
      await borrarMovimientoPendiente(client_id);
      subidas += 1;
    }
  }

  return { subidas, fallidas };
}

/**
 * Intenta subir a Supabase todo lo guardado offline (entregas de
 * Alimentos y movimientos de stock de Materiales). Usa "client_id"
 * (único) para no duplicar si algo ya se había subido pero el celular
 * no llegó a enterarse (p. ej. se cortó la señal justo después de
 * guardar).
 */
export async function sincronizarPendientes(): Promise<{ subidas: number; fallidas: number }> {
  if (sincronizando) return { subidas: 0, fallidas: 0 };
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { subidas: 0, fallidas: 0 };
  }

  sincronizando = true;
  try {
    const supabase = createClient();
    const [entregas, movimientos] = await Promise.all([
      subirEntregasPendientes(supabase),
      subirMovimientosPendientes(supabase),
    ]);
    return { subidas: entregas.subidas + movimientos.subidas, fallidas: entregas.fallidas + movimientos.fallidas };
  } finally {
    sincronizando = false;
  }
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

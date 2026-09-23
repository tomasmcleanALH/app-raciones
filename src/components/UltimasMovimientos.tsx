"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { listarMovimientosPendientes, type MovimientoPendiente } from "@/lib/offline/db";
import { escucharCambiosDeSync } from "@/lib/offline/sync";
import { getMaterialesActivos } from "@/lib/offline/catalogos";

interface Fila {
  id: string;
  fecha: string;
  material: string;
  tipo: "entrada" | "salida";
  cantidad: number;
  unidad: string;
  estado: "pendiente" | "sincronizado";
}

/** Muestra al usuario sus últimos movimientos: los pendientes de subir + los últimos confirmados. */
export default function UltimasMovimientos({ userId, campoId }: { userId: string; campoId: string }) {
  const [filas, setFilas] = useState<Fila[] | null>(null);

  const cargar = useCallback(async () => {
    const [materiales, pendientes] = await Promise.all([
      getMaterialesActivos(campoId).catch(() => []),
      listarMovimientosPendientes(),
    ]);
    const nombreMaterial = (id: string) => materiales.find((m) => m.id === id)?.nombre ?? "—";

    const filasPendientes: Fila[] = (pendientes as MovimientoPendiente[]).map((p) => ({
      id: p.client_id,
      fecha: p.fecha,
      material: nombreMaterial(p.material_id),
      tipo: p.tipo,
      cantidad: p.cantidad,
      unidad: p.unidad,
      estado: "pendiente",
    }));

    let filasSincronizadas: Fila[] = [];
    if (typeof navigator === "undefined" || navigator.onLine) {
      const supabase = createClient();
      const { data } = await supabase
        .from("movimientos_stock")
        .select("id, fecha, tipo, cantidad, unidad, materiales(nombre)")
        .eq("cargado_por", userId)
        .order("created_at", { ascending: false })
        .limit(5);

      filasSincronizadas = (data ?? []).map((m: any) => ({
        id: m.id,
        fecha: m.fecha,
        material: m.materiales?.nombre ?? "—",
        tipo: m.tipo,
        cantidad: m.cantidad,
        unidad: m.unidad,
        estado: "sincronizado",
      }));
    }

    setFilas([...filasPendientes, ...filasSincronizadas]);
  }, [userId, campoId]);

  useEffect(() => {
    cargar();
    const dejar = escucharCambiosDeSync(cargar);
    return dejar;
  }, [cargar]);

  if (!filas || filas.length === 0) return null;

  return (
    <div className="mt-6">
      <h2 className="mb-2 text-sm font-medium text-stone-500">Últimos movimientos</h2>
      <ul className="space-y-2">
        {filas.map((f) => (
          <li
            key={f.id}
            className="flex items-center justify-between rounded-lg bg-white px-4 py-2.5 text-sm shadow-sm ring-1 ring-stone-200"
          >
            <div>
              <span className="font-medium">{f.material}</span>
              <span className="ml-2 text-stone-400">
                {f.cantidad} {f.unidad} · {f.fecha}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {f.estado === "pendiente" && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                  sin subir
                </span>
              )}
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  f.tipo === "entrada" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                }`}
              >
                {f.tipo === "entrada" ? "Entrada" : "Salida"}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

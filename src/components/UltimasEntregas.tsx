"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { listarEntregasPendientes, type EntregaPendiente } from "@/lib/offline/db";
import { escucharCambiosDeSync } from "@/lib/offline/sync";
import { getAlimentosActivos, getLotesActivos } from "@/lib/offline/catalogos";

interface Fila {
  id: string;
  fecha_entrega: string;
  lote: string;
  alimento: string;
  cantidad: number;
  unidad: string;
  estado: "pendiente" | "sincronizada";
}

/** Muestra al tractorista sus últimas entregas: las pendientes de subir + las últimas confirmadas. */
export default function UltimasEntregas({ userId, campoId }: { userId: string; campoId: string }) {
  const [filas, setFilas] = useState<Fila[] | null>(null);

  const cargar = useCallback(async () => {
    const [lotes, alimentos, pendientes] = await Promise.all([
      getLotesActivos(campoId).catch(() => []),
      getAlimentosActivos(campoId).catch(() => []),
      listarEntregasPendientes(),
    ]);
    const nombreLote = (id: string) => lotes.find((l) => l.id === id)?.nombre ?? "—";
    const nombreAlimento = (id: string) => alimentos.find((a) => a.id === id)?.nombre ?? "—";

    const filasPendientes: Fila[] = (pendientes as EntregaPendiente[]).map((p) => ({
      id: p.client_id,
      fecha_entrega: p.fecha_entrega,
      lote: nombreLote(p.lote_id),
      alimento: nombreAlimento(p.alimento_id),
      cantidad: p.cantidad,
      unidad: p.unidad,
      estado: "pendiente",
    }));

    let filasSincronizadas: Fila[] = [];
    if (typeof navigator === "undefined" || navigator.onLine) {
      const supabase = createClient();
      const { data } = await supabase
        .from("entregas")
        .select("id, fecha_entrega, cantidad, unidad, lotes(nombre), alimentos(nombre)")
        .eq("cargado_por", userId)
        .order("created_at", { ascending: false })
        .limit(5);

      filasSincronizadas = (data ?? []).map((e: any) => ({
        id: e.id,
        fecha_entrega: e.fecha_entrega,
        lote: e.lotes?.nombre ?? "—",
        alimento: e.alimentos?.nombre ?? "—",
        cantidad: e.cantidad,
        unidad: e.unidad,
        estado: "sincronizada",
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
      <h2 className="mb-2 text-sm font-medium text-stone-500">Últimas entregas</h2>
      <ul className="space-y-2">
        {filas.map((f) => (
          <li
            key={f.id}
            className="flex items-center justify-between rounded-lg bg-white px-4 py-2.5 text-sm shadow-sm ring-1 ring-stone-200"
          >
            <div>
              <span className="font-medium">{f.alimento}</span> → {f.lote}
              <span className="ml-2 text-stone-400">
                {f.cantidad} {f.unidad} · {f.fecha_entrega}
              </span>
            </div>
            {f.estado === "pendiente" ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                sin subir
              </span>
            ) : (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                ✓
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

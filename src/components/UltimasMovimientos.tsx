"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Fila {
  id: string;
  fecha: string;
  isleta: string;
  material: string;
  tipo: "entrada" | "salida";
  cantidad: number;
  unidad: string;
}

/** Muestra las últimas 5 movimientos de stock cargados por este usuario. */
export default function UltimasMovimientos({ userId }: { userId: string }) {
  const [filas, setFilas] = useState<Fila[] | null>(null);

  const cargar = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("movimientos_stock")
      .select("id, fecha, tipo, cantidad, unidad, isletas(nombre), materiales(nombre)")
      .eq("cargado_por", userId)
      .order("created_at", { ascending: false })
      .limit(5);

    setFilas(
      (data ?? []).map((m: any) => ({
        id: m.id,
        fecha: m.fecha,
        isleta: m.isletas?.nombre ?? "—",
        material: m.materiales?.nombre ?? "—",
        tipo: m.tipo,
        cantidad: m.cantidad,
        unidad: m.unidad,
      })),
    );
  }, [userId]);

  useEffect(() => {
    cargar();
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
              <span className="font-medium">{f.material}</span> → {f.isleta}
              <span className="ml-2 text-stone-400">
                {f.cantidad} {f.unidad} · {f.fecha}
              </span>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                f.tipo === "entrada" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
              }`}
            >
              {f.tipo === "entrada" ? "Entrada" : "Salida"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

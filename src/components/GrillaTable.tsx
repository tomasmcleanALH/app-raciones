"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Alimento, Lote, Profile } from "@/lib/types";

interface FilaGrilla {
  id: string;
  fecha_entrega: string;
  cantidad: number;
  unidad: string;
  observaciones: string | null;
  created_at: string;
  lote_nombre: string;
  alimento_nombre: string;
  cargado_por_nombre: string;
}

export default function GrillaTable() {
  const [filas, setFilas] = useState<FilaGrilla[]>([]);
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [alimentos, setAlimentos] = useState<Alimento[]>([]);
  const [tractoristas, setTractoristas] = useState<Profile[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filtroLote, setFiltroLote] = useState("");
  const [filtroAlimento, setFiltroAlimento] = useState("");
  const [filtroUsuario, setFiltroUsuario] = useState("");
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from("lotes").select("*").order("nombre"),
      supabase.from("alimentos").select("*").order("nombre"),
      supabase.from("profiles").select("*").order("nombre"),
    ]).then(([l, a, p]) => {
      setLotes((l.data ?? []) as Lote[]);
      setAlimentos((a.data ?? []) as Alimento[]);
      setTractoristas((p.data ?? []) as Profile[]);
    });
  }, []);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    setError(null);

    const supabase = createClient();
    let query = supabase
      .from("entregas")
      .select(
        "id, fecha_entrega, cantidad, unidad, observaciones, created_at, lotes(nombre), alimentos(nombre), profiles(nombre)",
      )
      .order("fecha_entrega", { ascending: false })
      .order("created_at", { ascending: false });

    if (filtroLote) query = query.eq("lote_id", filtroLote);
    if (filtroAlimento) query = query.eq("alimento_id", filtroAlimento);
    if (filtroUsuario) query = query.eq("cargado_por", filtroUsuario);
    if (filtroDesde) query = query.gte("fecha_entrega", filtroDesde);
    if (filtroHasta) query = query.lte("fecha_entrega", filtroHasta);

    query.then(({ data, error }) => {
      if (cancelado) return;
      if (error) {
        setError(navigator.onLine ? error.message : "Sin señal: no se puede actualizar la grilla ahora.");
        setCargando(false);
        return;
      }
      setFilas(
        (data ?? []).map((e: any) => ({
          id: e.id,
          fecha_entrega: e.fecha_entrega,
          cantidad: e.cantidad,
          unidad: e.unidad,
          observaciones: e.observaciones,
          created_at: e.created_at,
          lote_nombre: e.lotes?.nombre ?? "—",
          alimento_nombre: e.alimentos?.nombre ?? "—",
          cargado_por_nombre: e.profiles?.nombre ?? "—",
        })),
      );
      setCargando(false);
    });

    return () => {
      cancelado = true;
    };
  }, [filtroLote, filtroAlimento, filtroUsuario, filtroDesde, filtroHasta]);

  const totalCantidad = useMemo(() => filas.reduce((acc, f) => acc + Number(f.cantidad), 0), [filas]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={filtroLote}
          onChange={(e) => setFiltroLote(e.target.value)}
          className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm"
        >
          <option value="">Todos los lotes</option>
          {lotes.map((l) => (
            <option key={l.id} value={l.id}>{l.nombre}</option>
          ))}
        </select>

        <select
          value={filtroAlimento}
          onChange={(e) => setFiltroAlimento(e.target.value)}
          className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm"
        >
          <option value="">Todos los alimentos</option>
          {alimentos.map((a) => (
            <option key={a.id} value={a.id}>{a.nombre}</option>
          ))}
        </select>

        <select
          value={filtroUsuario}
          onChange={(e) => setFiltroUsuario(e.target.value)}
          className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm"
        >
          <option value="">Todos los tractoristas</option>
          {tractoristas.map((t) => (
            <option key={t.id} value={t.id}>{t.nombre}</option>
          ))}
        </select>

        <input
          type="date"
          value={filtroDesde}
          onChange={(e) => setFiltroDesde(e.target.value)}
          className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm"
          aria-label="Desde"
        />
        <input
          type="date"
          value={filtroHasta}
          onChange={(e) => setFiltroHasta(e.target.value)}
          className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm"
          aria-label="Hasta"
        />

        {(filtroLote || filtroAlimento || filtroUsuario || filtroDesde || filtroHasta) && (
          <button
            onClick={() => {
              setFiltroLote("");
              setFiltroAlimento("");
              setFiltroUsuario("");
              setFiltroDesde("");
              setFiltroHasta("");
            }}
            className="rounded-lg px-3 py-1.5 text-sm text-stone-500 hover:bg-stone-100"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {error && <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{error}</p>}

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-stone-200">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
              <th className="px-4 py-2.5 font-medium">Fecha entrega</th>
              <th className="px-4 py-2.5 font-medium">Alimento</th>
              <th className="px-4 py-2.5 font-medium">Lote destino</th>
              <th className="px-4 py-2.5 font-medium">Cantidad</th>
              <th className="px-4 py-2.5 font-medium">Cargado por</th>
              <th className="px-4 py-2.5 font-medium">Observaciones</th>
              <th className="px-4 py-2.5 font-medium">Cargado el</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-stone-400">Cargando...</td>
              </tr>
            ) : filas.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-stone-400">No hay entregas registradas.</td>
              </tr>
            ) : (
              filas.map((f) => (
                <tr key={f.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50">
                  <td className="px-4 py-2.5">{f.fecha_entrega}</td>
                  <td className="px-4 py-2.5">{f.alimento_nombre}</td>
                  <td className="px-4 py-2.5">{f.lote_nombre}</td>
                  <td className="px-4 py-2.5">{f.cantidad} {f.unidad}</td>
                  <td className="px-4 py-2.5">{f.cargado_por_nombre}</td>
                  <td className="px-4 py-2.5 text-stone-500">{f.observaciones ?? ""}</td>
                  <td className="px-4 py-2.5 text-stone-400">
                    {new Date(f.created_at).toLocaleString("es-AR")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {filas.length > 0 && (
            <tfoot>
              <tr className="border-t border-stone-200 bg-stone-50 font-medium">
                <td className="px-4 py-2.5" colSpan={3}>Total ({filas.length} entregas)</td>
                <td className="px-4 py-2.5">{totalCantidad.toFixed(2)}</td>
                <td className="px-4 py-2.5" colSpan={3}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

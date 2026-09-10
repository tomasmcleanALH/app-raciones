"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";
import type { Alimento, Lote, Profile } from "@/lib/types";

interface FilaGrilla {
  id: string;
  fecha_entrega: string;
  lote_id: string;
  alimento_id: string;
  cantidad: number;
  unidad: string;
  observaciones: string | null;
  created_at: string;
  lote_nombre: string;
  alimento_nombre: string;
  cargado_por_nombre: string;
}

interface EntregaEditable {
  id: string;
  fecha_entrega: string;
  lote_id: string;
  alimento_id: string;
  cantidad: string;
  unidad: string;
  observaciones: string;
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

  const [menuAbierto, setMenuAbierto] = useState<string | null>(null);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState<string | null>(null);
  const [borrando, setBorrando] = useState(false);
  const [editando, setEditando] = useState<EntregaEditable | null>(null);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [errorEdicion, setErrorEdicion] = useState<string | null>(null);

  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());

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

  const cargarEntregas = useCallback(async () => {
    setCargando(true);
    setError(null);

    const supabase = createClient();
    let query = supabase
      .from("entregas")
      .select(
        "id, fecha_entrega, cantidad, unidad, observaciones, created_at, lote_id, alimento_id, lotes(nombre), alimentos(nombre), profiles(nombre)",
      )
      .order("fecha_entrega", { ascending: false })
      .order("created_at", { ascending: false });

    if (filtroLote) query = query.eq("lote_id", filtroLote);
    if (filtroAlimento) query = query.eq("alimento_id", filtroAlimento);
    if (filtroUsuario) query = query.eq("cargado_por", filtroUsuario);
    if (filtroDesde) query = query.gte("fecha_entrega", filtroDesde);
    if (filtroHasta) query = query.lte("fecha_entrega", filtroHasta);

    const { data, error } = await query;

    if (error) {
      setError(navigator.onLine ? error.message : "Sin señal: no se puede actualizar la grilla ahora.");
      setCargando(false);
      return;
    }

    setFilas(
      (data ?? []).map((e: any) => ({
        id: e.id,
        fecha_entrega: e.fecha_entrega,
        lote_id: e.lote_id,
        alimento_id: e.alimento_id,
        cantidad: e.cantidad,
        unidad: e.unidad,
        observaciones: e.observaciones,
        created_at: e.created_at,
        lote_nombre: e.lotes?.nombre ?? "—",
        alimento_nombre: e.alimentos?.nombre ?? "—",
        cargado_por_nombre: e.profiles?.nombre ?? "—",
      })),
    );
    setSeleccionados(new Set());
    setCargando(false);
  }, [filtroLote, filtroAlimento, filtroUsuario, filtroDesde, filtroHasta]);

  useEffect(() => {
    cargarEntregas();
  }, [cargarEntregas]);

  const totalCantidad = useMemo(() => filas.reduce((acc, f) => acc + Number(f.cantidad), 0), [filas]);

  function abrirEdicion(f: FilaGrilla) {
    setMenuAbierto(null);
    setErrorEdicion(null);
    setEditando({
      id: f.id,
      fecha_entrega: f.fecha_entrega,
      lote_id: f.lote_id,
      alimento_id: f.alimento_id,
      cantidad: String(f.cantidad),
      unidad: f.unidad,
      observaciones: f.observaciones ?? "",
    });
  }

  async function guardarEdicion(e: React.FormEvent) {
    e.preventDefault();
    if (!editando) return;
    setGuardandoEdicion(true);
    setErrorEdicion(null);

    const supabase = createClient();
    const { error } = await supabase
      .from("entregas")
      .update({
        fecha_entrega: editando.fecha_entrega,
        lote_id: editando.lote_id,
        alimento_id: editando.alimento_id,
        cantidad: Number(editando.cantidad),
        unidad: editando.unidad,
        observaciones: editando.observaciones.trim() || null,
      })
      .eq("id", editando.id);

    setGuardandoEdicion(false);

    if (error) {
      setErrorEdicion(error.message);
      return;
    }

    setEditando(null);
    cargarEntregas();
  }

  async function borrarEntrega(id: string) {
    setBorrando(true);
    const supabase = createClient();
    await supabase.from("entregas").delete().eq("id", id);
    setBorrando(false);
    setConfirmandoBorrado(null);
    setMenuAbierto(null);
    cargarEntregas();
  }

  function toggleSeleccionado(id: string) {
    setSeleccionados((actual) => {
      const nuevo = new Set(actual);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  }

  function toggleSeleccionarTodo() {
    setSeleccionados((actual) =>
      actual.size === filas.length ? new Set() : new Set(filas.map((f) => f.id)),
    );
  }

  function exportarExcel() {
    const filasAExportar = filas.filter((f) => seleccionados.has(f.id));
    if (filasAExportar.length === 0) return;

    const datos = filasAExportar.map((f) => ({
      "Fecha entrega": f.fecha_entrega,
      "Alimento": f.alimento_nombre,
      "Lote destino": f.lote_nombre,
      "Cantidad": f.cantidad,
      "Unidad": f.unidad,
      "Cargado por": f.cargado_por_nombre,
      "Observaciones": f.observaciones ?? "",
      "Cargado el": new Date(f.created_at).toLocaleString("es-AR"),
    }));

    const hoja = XLSX.utils.json_to_sheet(datos);
    hoja["!cols"] = [
      { wch: 13 }, { wch: 20 }, { wch: 16 }, { wch: 10 }, { wch: 10 }, { wch: 18 }, { wch: 30 }, { wch: 18 },
    ];
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Entregas");

    const hoy = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(libro, `entregas-${hoy}.xlsx`);
  }

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
          <option value="">Todos los usuarios</option>
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

        <button
          onClick={exportarExcel}
          disabled={seleccionados.size === 0}
          className="ml-auto rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400"
        >
          Exportar a Excel{seleccionados.size > 0 ? ` (${seleccionados.size})` : ""}
        </button>
      </div>

      {error && <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{error}</p>}

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-stone-200">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
              <th className="w-10 px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={filas.length > 0 && seleccionados.size === filas.length}
                  onChange={toggleSeleccionarTodo}
                  aria-label="Seleccionar todas"
                  className="h-4 w-4 rounded border-stone-300 accent-brand-700"
                />
              </th>
              <th className="px-4 py-2.5 font-medium">Fecha entrega</th>
              <th className="px-4 py-2.5 font-medium">Alimento</th>
              <th className="px-4 py-2.5 font-medium">Lote destino</th>
              <th className="px-4 py-2.5 font-medium">Cantidad</th>
              <th className="px-4 py-2.5 font-medium">Cargado por</th>
              <th className="px-4 py-2.5 font-medium">Observaciones</th>
              <th className="px-4 py-2.5 font-medium">Cargado el</th>
              <th className="w-10 px-2 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-stone-400">Cargando...</td>
              </tr>
            ) : filas.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-stone-400">No hay entregas registradas.</td>
              </tr>
            ) : (
              filas.map((f) => (
                <tr
                  key={f.id}
                  className={`border-b border-stone-100 last:border-0 hover:bg-stone-50 ${
                    seleccionados.has(f.id) ? "bg-brand-50" : ""
                  }`}
                >
                  <td className="px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={seleccionados.has(f.id)}
                      onChange={() => toggleSeleccionado(f.id)}
                      aria-label={`Seleccionar entrega del ${f.fecha_entrega}`}
                      className="h-4 w-4 rounded border-stone-300 accent-brand-700"
                    />
                  </td>
                  <td className="px-4 py-2.5">{f.fecha_entrega}</td>
                  <td className="px-4 py-2.5">{f.alimento_nombre}</td>
                  <td className="px-4 py-2.5">{f.lote_nombre}</td>
                  <td className="px-4 py-2.5">{f.cantidad} {f.unidad}</td>
                  <td className="px-4 py-2.5">{f.cargado_por_nombre}</td>
                  <td className="px-4 py-2.5 text-stone-500">{f.observaciones ?? ""}</td>
                  <td className="px-4 py-2.5 text-stone-400">
                    {new Date(f.created_at).toLocaleString("es-AR")}
                  </td>
                  <td className="relative px-2 py-2.5 text-right">
                    <button
                      onClick={() => {
                        setConfirmandoBorrado(null);
                        setMenuAbierto(menuAbierto === f.id ? null : f.id);
                      }}
                      className="rounded px-2 py-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                      aria-label="Más acciones"
                    >
                      ⋮
                    </button>

                    {menuAbierto === f.id && (
                      <>
                        <button
                          className="fixed inset-0 z-10 cursor-default"
                          onClick={() => setMenuAbierto(null)}
                          aria-label="Cerrar menú"
                        />
                        <div className="absolute right-2 top-full z-20 w-40 rounded-lg bg-white py-1 text-left shadow-lg ring-1 ring-stone-200">
                          {confirmandoBorrado === f.id ? (
                            <div className="px-3 py-2">
                              <p className="mb-2 text-xs text-stone-600">¿Borrar esta entrega?</p>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setConfirmandoBorrado(null)}
                                  className="flex-1 rounded bg-stone-100 px-2 py-1 text-xs hover:bg-stone-200"
                                >
                                  No
                                </button>
                                <button
                                  onClick={() => borrarEntrega(f.id)}
                                  disabled={borrando}
                                  className="flex-1 rounded bg-red-700 px-2 py-1 text-xs text-white hover:bg-red-800 disabled:opacity-60"
                                >
                                  {borrando ? "..." : "Sí"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => abrirEdicion(f)}
                                className="block w-full px-3 py-2 text-left text-sm text-stone-700 hover:bg-stone-50"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => setConfirmandoBorrado(f.id)}
                                className="block w-full px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
                              >
                                Borrar
                              </button>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {filas.length > 0 && (
            <tfoot>
              <tr className="border-t border-stone-200 bg-stone-50 font-medium">
                <td className="px-4 py-2.5" colSpan={4}>Total ({filas.length} entregas)</td>
                <td className="px-4 py-2.5">{totalCantidad.toFixed(2)}</td>
                <td className="px-4 py-2.5" colSpan={4}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {editando && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
          <form
            onSubmit={guardarEdicion}
            className="w-full max-w-sm space-y-4 rounded-xl bg-white p-5 shadow-xl"
          >
            <h2 className="text-lg font-bold text-stone-900">Editar entrega</h2>

            <div>
              <label className="block text-sm font-medium text-stone-700">Fecha de entrega</label>
              <input
                type="date"
                required
                value={editando.fecha_entrega}
                onChange={(e) => setEditando({ ...editando, fecha_entrega: e.target.value })}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-base focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700">Tipo de alimento</label>
              <select
                required
                value={editando.alimento_id}
                onChange={(e) => setEditando({ ...editando, alimento_id: e.target.value })}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-base focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
              >
                {alimentos.map((a) => (
                  <option key={a.id} value={a.id}>{a.nombre}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700">Lote destino</label>
              <select
                required
                value={editando.lote_id}
                onChange={(e) => setEditando({ ...editando, lote_id: e.target.value })}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-base focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
              >
                {lotes.map((l) => (
                  <option key={l.id} value={l.id}>{l.nombre}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-stone-700">Cantidad</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  required
                  value={editando.cantidad}
                  onChange={(e) => setEditando({ ...editando, cantidad: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-base focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
                />
              </div>
              <div className="w-28">
                <label className="block text-sm font-medium text-stone-700">Unidad</label>
                <select
                  value={editando.unidad}
                  onChange={(e) => setEditando({ ...editando, unidad: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-base focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
                >
                  <option value="kg">kg</option>
                  <option value="tn">tn</option>
                  <option value="bolsas">bolsas</option>
                  <option value="unidades">unidades</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700">Observaciones</label>
              <textarea
                value={editando.observaciones}
                onChange={(e) => setEditando({ ...editando, observaciones: e.target.value })}
                rows={2}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-base focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
              />
            </div>

            {errorEdicion && <p className="text-sm text-red-600">{errorEdicion}</p>}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setEditando(null)}
                disabled={guardandoEdicion}
                className="flex-1 rounded-lg border border-stone-300 px-4 py-2.5 font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardandoEdicion}
                className="flex-1 rounded-lg bg-brand-700 px-4 py-2.5 font-medium text-white hover:bg-brand-800 disabled:opacity-60"
              >
                {guardandoEdicion ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

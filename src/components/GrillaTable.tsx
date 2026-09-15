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

export default function GrillaTable({ campoId, puedeEditar = true }: { campoId: string; puedeEditar?: boolean }) {
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
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState<string | null>(null);
  const [borrando, setBorrando] = useState(false);
  const [editando, setEditando] = useState<EntregaEditable | null>(null);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [errorEdicion, setErrorEdicion] = useState<string | null>(null);

  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from("lotes").select("*").eq("campo_id", campoId).order("nombre"),
      supabase.from("alimentos").select("*").eq("campo_id", campoId).order("nombre"),
      supabase.from("usuarios_campos").select("profiles(*)").eq("campo_id", campoId),
    ]).then(([l, a, uc]) => {
      setLotes((l.data ?? []) as Lote[]);
      setAlimentos((a.data ?? []) as Alimento[]);
      const perfiles = (uc.data ?? [])
        .map((fila: any) => fila.profiles as Profile)
        .filter(Boolean)
        .sort((a: Profile, b: Profile) => a.nombre.localeCompare(b.nombre));
      setTractoristas(perfiles);
    });
  }, [campoId]);

  const cargarEntregas = useCallback(async () => {
    setCargando(true);
    setError(null);

    const supabase = createClient();
    let query = supabase
      .from("entregas")
      .select(
        "id, fecha_entrega, cantidad, unidad, observaciones, created_at, lote_id, alimento_id, lotes!inner(nombre, campo_id), alimentos(nombre), profiles(nombre)",
      )
      .eq("lotes.campo_id", campoId)
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
  }, [campoId, filtroLote, filtroAlimento, filtroUsuario, filtroDesde, filtroHasta]);

  useEffect(() => {
    cargarEntregas();
  }, [cargarEntregas]);

  const totalColumnas = puedeEditar ? 9 : 8;

  /** Suma la cantidad entregada de cada alimento (agrupada también por unidad,
   * por si el mismo alimento se cargó alguna vez con otra unidad). */
  const resumenAlimentos = useMemo(() => {
    const mapa = new Map<string, { alimento: string; unidad: string; total: number }>();
    for (const f of filas) {
      const clave = `${f.alimento_nombre}|${f.unidad}`;
      const actual = mapa.get(clave);
      if (actual) actual.total += Number(f.cantidad);
      else mapa.set(clave, { alimento: f.alimento_nombre, unidad: f.unidad, total: Number(f.cantidad) });
    }
    return [...mapa.values()].sort((a, b) => a.alimento.localeCompare(b.alimento));
  }, [filas]);

  /** El menú "⋮" se posiciona con position:fixed (según el botón que lo abrió)
   * en vez de absolute, para que no quede recortado por el scroll horizontal
   * de la tabla (overflow-x-auto en el contenedor obliga a overflow-y:auto
   * también, y eso recortaba el menú cuando había pocas filas). */
  function abrirMenu(e: React.MouseEvent<HTMLButtonElement>, id: string) {
    setConfirmandoBorrado(null);
    if (menuAbierto === id) {
      setMenuAbierto(null);
      setMenuPos(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuAbierto(id);
    setMenuPos({ top: rect.bottom + 4, left: Math.max(8, rect.right - 160) });
  }

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
      "Cargado el": new Date(f.created_at).toLocaleString("es-AR", { hour12: false }),
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

  const hayFiltrosActivos = !!(filtroLote || filtroAlimento || filtroUsuario || filtroDesde || filtroHasta);

  const controlesFiltro = (
    <>
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

      {hayFiltrosActivos && (
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
    </>
  );

  const botonExportar = (
    <button
      onClick={exportarExcel}
      disabled={seleccionados.size === 0}
      title={`Exportar a Excel${seleccionados.size > 0 ? ` (${seleccionados.size} seleccionadas)` : ""}`}
      aria-label="Exportar a Excel"
      className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1D6F42] text-white hover:bg-[#175c37] disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M4 9h16M4 15h16M10 3v18M14 3v18" strokeWidth="1.1" opacity="0.65" />
      </svg>
      {seleccionados.size > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-700 px-1 text-[10px] font-bold text-white">
          {seleccionados.size}
        </span>
      )}
    </button>
  );

  const botonActualizar = (
    <button
      onClick={() => cargarEntregas()}
      disabled={cargando}
      title="Actualizar"
      aria-label="Actualizar"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <svg
        viewBox="0 0 24 24"
        className={`h-5 w-5 ${cargando ? "animate-spin" : ""}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 20v-5h-5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 9a7.5 7.5 0 0 1 13-3.5L20 8" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.5 15a7.5 7.5 0 0 1-13 3.5L4 16" />
      </svg>
    </button>
  );

  const menuAcciones = (f: FilaGrilla) => (
    <>
      <button
        className="fixed inset-0 z-10 cursor-default"
        onClick={() => setMenuAbierto(null)}
        aria-label="Cerrar menú"
      />
      <div className="absolute right-0 top-full z-20 w-40 rounded-lg bg-white py-1 text-left shadow-lg ring-1 ring-stone-200">
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
  );

  const resumenAlimentosPanel = (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
      <h2 className="mb-3 text-sm font-semibold text-stone-700">Resumen por alimento</h2>
      {filas.length === 0 ? (
        <p className="text-sm text-stone-400">Sin entregas para resumir.</p>
      ) : (
        <ul className="space-y-2">
          {resumenAlimentos.map((r) => (
            <li key={`${r.alimento}|${r.unidad}`} className="flex items-start justify-between gap-3 text-sm">
              <span className="text-stone-600">{r.alimento}</span>
              <span className="shrink-0 font-medium text-stone-900">
                {r.total.toLocaleString("es-AR", { maximumFractionDigits: 2 })} {r.unidad}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="lg:flex lg:items-start lg:gap-6">
    <div className="min-w-0 lg:flex-1">
      {/* Filtros — escritorio: barra fija, igual que siempre */}
      <div className="mb-4 hidden flex-wrap items-center gap-2 md:flex">
        {controlesFiltro}
        <div className="ml-auto flex gap-2">
          {botonActualizar}
          {botonExportar}
        </div>
      </div>

      {/* Filtros — celular: acordeón desplegable, con el ícono de exportar al lado */}
      <div className="mb-4 flex items-start gap-2 md:hidden">
        <details className="flex-1 rounded-xl bg-white shadow-sm ring-1 ring-stone-200">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-stone-700">
            <span className="inline-flex items-center gap-1.5">
              Filtros de búsqueda
              {hayFiltrosActivos && <span className="h-1.5 w-1.5 rounded-full bg-brand-700" />}
            </span>
          </summary>
          <div className="flex flex-col gap-2 border-t border-stone-100 p-3">{controlesFiltro}</div>
        </details>
        {botonActualizar}
        {botonExportar}
      </div>

      {error && <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{error}</p>}

      {/* Celular: tarjetas */}
      <div className="space-y-3 md:hidden">
        {cargando ? (
          <p className="rounded-xl bg-white p-6 text-center text-sm text-stone-400 shadow-sm ring-1 ring-stone-200">Cargando...</p>
        ) : filas.length === 0 ? (
          <p className="rounded-xl bg-white p-6 text-center text-sm text-stone-400 shadow-sm ring-1 ring-stone-200">No hay entregas registradas.</p>
        ) : (
          <>
            <label className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm text-stone-600 shadow-sm ring-1 ring-stone-200">
              <input
                type="checkbox"
                checked={filas.length > 0 && seleccionados.size === filas.length}
                onChange={toggleSeleccionarTodo}
                className="h-4 w-4 rounded border-stone-300 accent-brand-700"
              />
              Seleccionar todas
            </label>

            {filas.map((f) => (
              <div
                key={f.id}
                className={`relative rounded-xl p-4 text-sm shadow-sm ring-1 ${
                  seleccionados.has(f.id) ? "bg-brand-50 ring-brand-200" : "bg-white ring-stone-200"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <label className="flex items-center gap-2 font-semibold text-stone-900">
                    <input
                      type="checkbox"
                      checked={seleccionados.has(f.id)}
                      onChange={() => toggleSeleccionado(f.id)}
                      aria-label={`Seleccionar entrega del ${f.fecha_entrega}`}
                      className="h-4 w-4 rounded border-stone-300 accent-brand-700"
                    />
                    {f.fecha_entrega}
                  </label>

                  {puedeEditar && (
                    <button
                      onClick={() => {
                        setConfirmandoBorrado(null);
                        setMenuAbierto(menuAbierto === f.id ? null : f.id);
                      }}
                      className="-mt-1 -mr-1 rounded px-2 py-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                      aria-label="Más acciones"
                    >
                      ⋮
                    </button>
                  )}
                  {puedeEditar && menuAbierto === f.id && menuAcciones(f)}
                </div>

                <div className="mt-2 space-y-1 pl-6 text-stone-700">
                  <p><span className="text-stone-500">Alimento:</span> {f.alimento_nombre}</p>
                  <p>
                    <span className="text-stone-500">Lote destino:</span> {f.lote_nombre}
                    <span className="mx-1.5 text-stone-300">|</span>
                    <span className="text-stone-500">Cantidad:</span> {f.cantidad} {f.unidad}
                  </p>
                  <p><span className="text-stone-500">Cargado por:</span> {f.cargado_por_nombre}</p>
                  {f.observaciones && (
                    <p><span className="text-stone-500">Observaciones:</span> {f.observaciones}</p>
                  )}
                  <p className="pt-1 text-xs text-stone-400">
                    Cargado el {new Date(f.created_at).toLocaleString("es-AR", { hour12: false })}
                  </p>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Escritorio: tabla, sin cambios */}
      <div className="hidden overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-stone-200 md:block">
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
              {puedeEditar && <th className="w-10 px-2 py-2.5"></th>}
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr>
                <td colSpan={totalColumnas} className="px-4 py-6 text-center text-stone-400">Cargando...</td>
              </tr>
            ) : filas.length === 0 ? (
              <tr>
                <td colSpan={totalColumnas} className="px-4 py-6 text-center text-stone-400">No hay entregas registradas.</td>
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
                    {new Date(f.created_at).toLocaleString("es-AR", { hour12: false })}
                  </td>
                  {puedeEditar && (
                  <td className="relative px-2 py-2.5 text-right">
                    <button
                      onClick={(e) => abrirMenu(e, f.id)}
                      className="rounded px-2 py-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                      aria-label="Más acciones"
                    >
                      ⋮
                    </button>

                    {menuAbierto === f.id && menuPos && (
                      <>
                        <button
                          className="fixed inset-0 z-10 cursor-default"
                          onClick={() => setMenuAbierto(null)}
                          aria-label="Cerrar menú"
                        />
                        <div
                          style={{ position: "fixed", top: menuPos.top, left: menuPos.left }}
                          className="z-20 w-40 rounded-lg bg-white py-1 text-left shadow-lg ring-1 ring-stone-200"
                        >
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
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>

    <div className="mt-4 lg:mt-0 lg:w-72 lg:shrink-0">{resumenAlimentosPanel}</div>

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

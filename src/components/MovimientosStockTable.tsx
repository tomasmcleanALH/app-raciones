"use client";

import { useCallback, useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";
import type { Material, Profile, TipoMovimiento } from "@/lib/types";

interface FilaGrilla {
  id: string;
  fecha: string;
  material_id: string;
  tipo: TipoMovimiento;
  cantidad: number;
  unidad: string;
  observaciones: string | null;
  created_at: string;
  material_nombre: string;
  cargado_por_nombre: string;
}

interface MovimientoEditable {
  id: string;
  fecha: string;
  material_id: string;
  tipo: TipoMovimiento;
  cantidad: string;
  unidad: string;
  observaciones: string;
}

export default function MovimientosStockTable({ campoId, puedeEditar = true }: { campoId: string; puedeEditar?: boolean }) {
  const [filas, setFilas] = useState<FilaGrilla[]>([]);
  const [materiales, setMateriales] = useState<Material[]>([]);
  const [usuarios, setUsuarios] = useState<Profile[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filtroMaterial, setFiltroMaterial] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroUsuario, setFiltroUsuario] = useState("");
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");

  const [menuAbierto, setMenuAbierto] = useState<string | null>(null);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState<string | null>(null);
  const [borrando, setBorrando] = useState(false);
  const [editando, setEditando] = useState<MovimientoEditable | null>(null);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [errorEdicion, setErrorEdicion] = useState<string | null>(null);

  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from("materiales").select("*").eq("campo_id", campoId).order("nombre"),
      supabase
        .from("profiles")
        .select("*, usuarios_campos!inner(campo_id), usuarios_modulos!inner(modulo)")
        .eq("usuarios_campos.campo_id", campoId)
        .eq("usuarios_modulos.modulo", "materiales"),
    ]).then(([m, u]) => {
      setMateriales((m.data ?? []) as Material[]);
      setUsuarios(((u.data ?? []) as Profile[]).sort((a, b) => a.nombre.localeCompare(b.nombre)));
    });
  }, [campoId]);

  const cargarMovimientos = useCallback(async () => {
    setCargando(true);
    setError(null);

    const supabase = createClient();
    let query = supabase
      .from("movimientos_stock")
      .select(
        "id, fecha, cantidad, unidad, tipo, observaciones, created_at, material_id, materiales!inner(nombre, campo_id), profiles(nombre)",
      )
      .eq("materiales.campo_id", campoId)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false });

    if (filtroMaterial) query = query.eq("material_id", filtroMaterial);
    if (filtroTipo) query = query.eq("tipo", filtroTipo);
    if (filtroUsuario) query = query.eq("cargado_por", filtroUsuario);
    if (filtroDesde) query = query.gte("fecha", filtroDesde);
    if (filtroHasta) query = query.lte("fecha", filtroHasta);

    const { data, error } = await query;

    if (error) {
      setError(navigator.onLine ? error.message : "Sin señal: no se puede actualizar la grilla ahora.");
      setCargando(false);
      return;
    }

    setFilas(
      (data ?? []).map((m: any) => ({
        id: m.id,
        fecha: m.fecha,
        material_id: m.material_id,
        tipo: m.tipo,
        cantidad: m.cantidad,
        unidad: m.unidad,
        observaciones: m.observaciones,
        created_at: m.created_at,
        material_nombre: m.materiales?.nombre ?? "—",
        cargado_por_nombre: m.profiles?.nombre ?? "—",
      })),
    );
    setSeleccionados(new Set());
    setCargando(false);
  }, [campoId, filtroMaterial, filtroTipo, filtroUsuario, filtroDesde, filtroHasta]);

  useEffect(() => {
    cargarMovimientos();
  }, [cargarMovimientos]);

  const totalColumnas = puedeEditar ? 9 : 8;

  function abrirEdicion(f: FilaGrilla) {
    setMenuAbierto(null);
    setErrorEdicion(null);
    setEditando({
      id: f.id,
      fecha: f.fecha,
      material_id: f.material_id,
      tipo: f.tipo,
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
      .from("movimientos_stock")
      .update({
        fecha: editando.fecha,
        material_id: editando.material_id,
        tipo: editando.tipo,
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
    cargarMovimientos();
  }

  async function borrarMovimiento(id: string) {
    setBorrando(true);
    const supabase = createClient();
    await supabase.from("movimientos_stock").delete().eq("id", id);
    setBorrando(false);
    setConfirmandoBorrado(null);
    setMenuAbierto(null);
    cargarMovimientos();
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
      "Fecha": f.fecha,
      "Material": f.material_nombre,
      "Tipo": f.tipo === "entrada" ? "Entrada" : "Salida",
      "Cantidad": f.cantidad,
      "Unidad": f.unidad,
      "Cargado por": f.cargado_por_nombre,
      "Observaciones": f.observaciones ?? "",
      "Cargado el": new Date(f.created_at).toLocaleString("es-AR", { hour12: false }),
    }));

    const hoja = XLSX.utils.json_to_sheet(datos);
    hoja["!cols"] = [
      { wch: 13 }, { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 18 }, { wch: 30 }, { wch: 18 },
    ];
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Movimientos");

    const hoy = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(libro, `historial-movimientos-${hoy}.xlsx`);
  }

  const hayFiltrosActivos = !!(filtroMaterial || filtroTipo || filtroUsuario || filtroDesde || filtroHasta);

  const controlesFiltro = (
    <>
      <select
        value={filtroMaterial}
        onChange={(e) => setFiltroMaterial(e.target.value)}
        className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm"
      >
        <option value="">Todos los materiales</option>
        {materiales.map((m) => (
          <option key={m.id} value={m.id}>{m.nombre}</option>
        ))}
      </select>

      <select
        value={filtroTipo}
        onChange={(e) => setFiltroTipo(e.target.value)}
        className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm"
      >
        <option value="">Entradas y salidas</option>
        <option value="entrada">Sólo entradas</option>
        <option value="salida">Sólo salidas</option>
      </select>

      <select
        value={filtroUsuario}
        onChange={(e) => setFiltroUsuario(e.target.value)}
        className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm"
      >
        <option value="">Todos los usuarios</option>
        {usuarios.map((u) => (
          <option key={u.id} value={u.id}>{u.nombre}</option>
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
            setFiltroMaterial("");
            setFiltroTipo("");
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
      title={`Exportar a Excel${seleccionados.size > 0 ? ` (${seleccionados.size} seleccionados)` : ""}`}
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
      onClick={() => cargarMovimientos()}
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

  const badgeTipo = (tipo: TipoMovimiento) => (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        tipo === "entrada" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
      }`}
    >
      {tipo === "entrada" ? "Entrada" : "Salida"}
    </span>
  );

  return (
    <div>
      {/* Filtros — escritorio: barra fija, igual que en la grilla de alimentos */}
      <div className="mb-4 hidden flex-wrap items-center gap-2 md:flex">
        {controlesFiltro}
        <div className="ml-auto flex gap-2">
          {botonActualizar}
          {botonExportar}
        </div>
      </div>

      {/* Filtros — celular: acordeón desplegable */}
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
          <p className="rounded-xl bg-white p-6 text-center text-sm text-stone-400 shadow-sm ring-1 ring-stone-200">No hay movimientos registrados.</p>
        ) : (
          <>
            <label className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm text-stone-600 shadow-sm ring-1 ring-stone-200">
              <input
                type="checkbox"
                checked={filas.length > 0 && seleccionados.size === filas.length}
                onChange={toggleSeleccionarTodo}
                className="h-4 w-4 rounded border-stone-300 accent-brand-700"
              />
              Seleccionar todos
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
                      aria-label={`Seleccionar movimiento del ${f.fecha}`}
                      className="h-4 w-4 rounded border-stone-300 accent-brand-700"
                    />
                    {f.fecha}
                  </label>

                  <div className="flex items-center gap-1">
                    {badgeTipo(f.tipo)}
                    {puedeEditar && (
                      <button
                        onClick={() => {
                          setConfirmandoBorrado(null);
                          setMenuAbierto(menuAbierto === f.id ? null : f.id);
                        }}
                        className="-mr-1 rounded px-2 py-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                        aria-label="Más acciones"
                      >
                        ⋮
                      </button>
                    )}
                  </div>
                  {puedeEditar && menuAbierto === f.id && (
                    <>
                      <button
                        className="fixed inset-0 z-10 cursor-default"
                        onClick={() => setMenuAbierto(null)}
                        aria-label="Cerrar menú"
                      />
                      <div className="absolute right-2 top-10 z-20 w-40 rounded-lg bg-white py-1 text-left shadow-lg ring-1 ring-stone-200">
                        {confirmandoBorrado === f.id ? (
                          <div className="px-3 py-2">
                            <p className="mb-2 text-xs text-stone-600">¿Borrar este movimiento?</p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setConfirmandoBorrado(null)}
                                className="flex-1 rounded bg-stone-100 px-2 py-1 text-xs hover:bg-stone-200"
                              >
                                No
                              </button>
                              <button
                                onClick={() => borrarMovimiento(f.id)}
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
                </div>

                <div className="mt-2 space-y-1 pl-6 text-stone-700">
                  <p><span className="text-stone-500">Material:</span> {f.material_nombre}</p>
                  <p><span className="text-stone-500">Cantidad:</span> {f.cantidad} {f.unidad}</p>
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

      {/* Escritorio: tabla */}
      <div className="hidden overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-stone-200 md:block">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
              <th className="w-10 px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={filas.length > 0 && seleccionados.size === filas.length}
                  onChange={toggleSeleccionarTodo}
                  aria-label="Seleccionar todos"
                  className="h-4 w-4 rounded border-stone-300 accent-brand-700"
                />
              </th>
              <th className="px-4 py-2.5 font-medium">Fecha</th>
              <th className="px-4 py-2.5 font-medium">Material</th>
              <th className="px-4 py-2.5 font-medium">Tipo</th>
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
                <td colSpan={totalColumnas} className="px-4 py-6 text-center text-stone-400">No hay movimientos registrados.</td>
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
                      aria-label={`Seleccionar movimiento del ${f.fecha}`}
                      className="h-4 w-4 rounded border-stone-300 accent-brand-700"
                    />
                  </td>
                  <td className="px-4 py-2.5">{f.fecha}</td>
                  <td className="px-4 py-2.5">{f.material_nombre}</td>
                  <td className="px-4 py-2.5">{badgeTipo(f.tipo)}</td>
                  <td className="px-4 py-2.5">{f.cantidad} {f.unidad}</td>
                  <td className="px-4 py-2.5">{f.cargado_por_nombre}</td>
                  <td className="px-4 py-2.5 text-stone-500">{f.observaciones ?? ""}</td>
                  <td className="px-4 py-2.5 text-stone-400">
                    {new Date(f.created_at).toLocaleString("es-AR", { hour12: false })}
                  </td>
                  {puedeEditar && (
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
                              <p className="mb-2 text-xs text-stone-600">¿Borrar este movimiento?</p>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setConfirmandoBorrado(null)}
                                  className="flex-1 rounded bg-stone-100 px-2 py-1 text-xs hover:bg-stone-200"
                                >
                                  No
                                </button>
                                <button
                                  onClick={() => borrarMovimiento(f.id)}
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

      {editando && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
          <form
            onSubmit={guardarEdicion}
            className="w-full max-w-sm space-y-4 rounded-xl bg-white p-5 shadow-xl"
          >
            <h2 className="text-lg font-bold text-stone-900">Editar movimiento</h2>

            <div>
              <label className="block text-sm font-medium text-stone-700">Tipo</label>
              <select
                value={editando.tipo}
                onChange={(e) => setEditando({ ...editando, tipo: e.target.value as TipoMovimiento })}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-base focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
              >
                <option value="entrada">Entrada</option>
                <option value="salida">Salida</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700">Fecha</label>
              <input
                type="date"
                required
                value={editando.fecha}
                onChange={(e) => setEditando({ ...editando, fecha: e.target.value })}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-base focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700">Material</label>
              <select
                required
                value={editando.material_id}
                onChange={(e) => setEditando({ ...editando, material_id: e.target.value })}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-base focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
              >
                {materiales.map((m) => (
                  <option key={m.id} value={m.id}>{m.nombre}</option>
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
              <div className="w-32">
                <label className="block text-sm font-medium text-stone-700">Unidad</label>
                <select
                  value={editando.unidad}
                  onChange={(e) => setEditando({ ...editando, unidad: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-base focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
                >
                  <option value="unidades">unidades</option>
                  <option value="rollos">rollos</option>
                  <option value="metros">metros</option>
                  <option value="kg">kg</option>
                  <option value="bolsas">bolsas</option>
                  <option value="litros">litros</option>
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

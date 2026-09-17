"use client";

import { useCallback, useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";
import type { Alimento, BolsonAlimento, Lote, Profile, ProveedorAlimento, TipoMovimiento, UbicacionAlimento } from "@/lib/types";

interface FilaHistorial {
  id: string;
  tipo: TipoMovimiento;
  fecha: string;
  alimento_id: string;
  alimento_nombre: string;
  cantidad: number;
  unidad: string;
  observaciones: string | null;
  created_at: string;
  cargado_por_nombre: string;
  lote_id: string | null;
  lote_nombre: string | null;
  proveedor_id: string | null;
  proveedor_nombre: string | null;
  ubicacion_id: string | null;
  ubicacion_nombre: string | null;
  bolson_id: string | null;
  bolson_nombre: string | null;
}

type Editable =
  | {
      kind: "salida";
      id: string;
      fecha: string;
      lote_id: string;
      alimento_id: string;
      ubicacion_id: string;
      bolson_id: string;
      cantidad: string;
      unidad: string;
      observaciones: string;
    }
  | {
      kind: "entrada";
      id: string;
      fecha: string;
      alimento_id: string;
      proveedor_id: string;
      ubicacion_id: string;
      bolson_id: string;
      cantidad: string;
      unidad: string;
      observaciones: string;
    };

export default function HistorialAlimentos({ campoId, puedeEditar = true }: { campoId: string; puedeEditar?: boolean }) {
  const [filas, setFilas] = useState<FilaHistorial[]>([]);
  const [alimentos, setAlimentos] = useState<Alimento[]>([]);
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [proveedores, setProveedores] = useState<ProveedorAlimento[]>([]);
  const [ubicaciones, setUbicaciones] = useState<UbicacionAlimento[]>([]);
  const [bolsones, setBolsones] = useState<BolsonAlimento[]>([]);
  const [usuarios, setUsuarios] = useState<Profile[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filtroAlimento, setFiltroAlimento] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroUbicacion, setFiltroUbicacion] = useState("");
  const [filtroBolson, setFiltroBolson] = useState("");
  const [filtroUsuario, setFiltroUsuario] = useState("");
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");

  const [menuAbierto, setMenuAbierto] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState<string | null>(null);
  const [borrando, setBorrando] = useState(false);
  const [editando, setEditando] = useState<Editable | null>(null);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [errorEdicion, setErrorEdicion] = useState<string | null>(null);

  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from("alimentos").select("*").eq("campo_id", campoId).order("nombre"),
      supabase.from("lotes").select("*").eq("campo_id", campoId).order("nombre"),
      supabase.from("proveedores_alimentos").select("*").eq("campo_id", campoId).order("nombre"),
      supabase.from("ubicaciones_alimentos").select("*").eq("campo_id", campoId).order("nombre"),
      supabase.from("bolsones_alimentos").select("*").eq("campo_id", campoId).order("nombre"),
      supabase
        .from("profiles")
        .select("*, usuarios_campos!inner(campo_id), usuarios_modulos!inner(modulo)")
        .eq("usuarios_campos.campo_id", campoId)
        .eq("usuarios_modulos.modulo", "alimentos"),
    ]).then(([a, l, p, ub, b, u]) => {
      setAlimentos((a.data ?? []) as Alimento[]);
      setLotes((l.data ?? []) as Lote[]);
      setProveedores((p.data ?? []) as ProveedorAlimento[]);
      setUbicaciones((ub.data ?? []) as UbicacionAlimento[]);
      setBolsones((b.data ?? []) as BolsonAlimento[]);
      setUsuarios(((u.data ?? []) as Profile[]).sort((a, b) => a.nombre.localeCompare(b.nombre)));
    });
  }, [campoId]);

  const cargarMovimientos = useCallback(async () => {
    setCargando(true);
    setError(null);

    const supabase = createClient();
    const resultado: FilaHistorial[] = [];

    if (filtroTipo !== "salida") {
      let q = supabase
        .from("entradas_alimentos")
        .select(
          "id, fecha, cantidad, unidad, observaciones, created_at, alimento_id, proveedor_id, ubicacion_id, bolson_id, alimentos!inner(nombre, campo_id), proveedores_alimentos(nombre), ubicaciones_alimentos(nombre), bolsones_alimentos(nombre), profiles(nombre)",
        )
        .eq("alimentos.campo_id", campoId);
      if (filtroAlimento) q = q.eq("alimento_id", filtroAlimento);
      if (filtroUbicacion) q = q.eq("ubicacion_id", filtroUbicacion);
      if (filtroBolson) q = q.eq("bolson_id", filtroBolson);
      if (filtroUsuario) q = q.eq("cargado_por", filtroUsuario);
      if (filtroDesde) q = q.gte("fecha", filtroDesde);
      if (filtroHasta) q = q.lte("fecha", filtroHasta);

      const { data, error } = await q;
      if (error) {
        setError(navigator.onLine ? error.message : "Sin señal: no se puede actualizar la grilla ahora.");
        setCargando(false);
        return;
      }
      for (const e of (data ?? []) as any[]) {
        resultado.push({
          id: e.id,
          tipo: "entrada",
          fecha: e.fecha,
          alimento_id: e.alimento_id,
          alimento_nombre: e.alimentos?.nombre ?? "—",
          cantidad: e.cantidad,
          unidad: e.unidad,
          observaciones: e.observaciones,
          created_at: e.created_at,
          cargado_por_nombre: e.profiles?.nombre ?? "—",
          lote_id: null,
          lote_nombre: null,
          proveedor_id: e.proveedor_id,
          proveedor_nombre: e.proveedores_alimentos?.nombre ?? null,
          ubicacion_id: e.ubicacion_id,
          ubicacion_nombre: e.ubicaciones_alimentos?.nombre ?? null,
          bolson_id: e.bolson_id,
          bolson_nombre: e.bolsones_alimentos?.nombre ?? null,
        });
      }
    }

    if (filtroTipo !== "entrada") {
      let q = supabase
        .from("entregas")
        .select(
          "id, fecha_entrega, cantidad, unidad, observaciones, created_at, alimento_id, lote_id, ubicacion_id, bolson_id, lotes!inner(nombre, campo_id), alimentos(nombre), ubicaciones_alimentos(nombre), bolsones_alimentos(nombre), profiles(nombre)",
        )
        .eq("lotes.campo_id", campoId);
      if (filtroAlimento) q = q.eq("alimento_id", filtroAlimento);
      if (filtroUbicacion) q = q.eq("ubicacion_id", filtroUbicacion);
      if (filtroBolson) q = q.eq("bolson_id", filtroBolson);
      if (filtroUsuario) q = q.eq("cargado_por", filtroUsuario);
      if (filtroDesde) q = q.gte("fecha_entrega", filtroDesde);
      if (filtroHasta) q = q.lte("fecha_entrega", filtroHasta);

      const { data, error } = await q;
      if (error) {
        setError(navigator.onLine ? error.message : "Sin señal: no se puede actualizar la grilla ahora.");
        setCargando(false);
        return;
      }
      for (const s of (data ?? []) as any[]) {
        resultado.push({
          id: s.id,
          tipo: "salida",
          fecha: s.fecha_entrega,
          alimento_id: s.alimento_id,
          alimento_nombre: s.alimentos?.nombre ?? "—",
          cantidad: s.cantidad,
          unidad: s.unidad,
          observaciones: s.observaciones,
          created_at: s.created_at,
          cargado_por_nombre: s.profiles?.nombre ?? "—",
          lote_id: s.lote_id,
          lote_nombre: s.lotes?.nombre ?? null,
          proveedor_id: null,
          proveedor_nombre: null,
          ubicacion_id: s.ubicacion_id,
          ubicacion_nombre: s.ubicaciones_alimentos?.nombre ?? null,
          bolson_id: s.bolson_id,
          bolson_nombre: s.bolsones_alimentos?.nombre ?? null,
        });
      }
    }

    resultado.sort((a, b) => b.fecha.localeCompare(a.fecha) || b.created_at.localeCompare(a.created_at));
    setFilas(resultado);
    setSeleccionados(new Set());
    setCargando(false);
  }, [campoId, filtroAlimento, filtroTipo, filtroUbicacion, filtroBolson, filtroUsuario, filtroDesde, filtroHasta]);

  useEffect(() => {
    cargarMovimientos();
  }, [cargarMovimientos]);

  const totalColumnas = puedeEditar ? 10 : 9;

  function detalle(f: FilaHistorial) {
    const bolson = f.bolson_nombre ? ` · Bolsón: ${f.bolson_nombre}` : "";
    if (f.tipo === "entrada") {
      return `Proveedor: ${f.proveedor_nombre ?? "—"} · Ubicación: ${f.ubicacion_nombre ?? "—"}${bolson}`;
    }
    return `Ubicación: ${f.ubicacion_nombre ?? "—"}${bolson} · Lote: ${f.lote_nombre ?? "—"}`;
  }

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

  function abrirEdicion(f: FilaHistorial) {
    setMenuAbierto(null);
    setErrorEdicion(null);
    setEditando(
      f.tipo === "salida"
        ? {
            kind: "salida",
            id: f.id,
            fecha: f.fecha,
            lote_id: f.lote_id ?? "",
            alimento_id: f.alimento_id,
            ubicacion_id: f.ubicacion_id ?? "",
            bolson_id: f.bolson_id ?? "",
            cantidad: String(f.cantidad),
            unidad: f.unidad,
            observaciones: f.observaciones ?? "",
          }
        : {
            kind: "entrada",
            id: f.id,
            fecha: f.fecha,
            alimento_id: f.alimento_id,
            proveedor_id: f.proveedor_id ?? "",
            ubicacion_id: f.ubicacion_id ?? "",
            bolson_id: f.bolson_id ?? "",
            cantidad: String(f.cantidad),
            unidad: f.unidad,
            observaciones: f.observaciones ?? "",
          },
    );
  }

  async function guardarEdicion(e: React.FormEvent) {
    e.preventDefault();
    if (!editando) return;
    setGuardandoEdicion(true);
    setErrorEdicion(null);

    const supabase = createClient();
    const { error } =
      editando.kind === "salida"
        ? await supabase
            .from("entregas")
            .update({
              fecha_entrega: editando.fecha,
              lote_id: editando.lote_id,
              alimento_id: editando.alimento_id,
              ubicacion_id: editando.ubicacion_id || null,
              bolson_id: editando.bolson_id || null,
              cantidad: Number(editando.cantidad),
              unidad: editando.unidad,
              observaciones: editando.observaciones.trim() || null,
            })
            .eq("id", editando.id)
        : await supabase
            .from("entradas_alimentos")
            .update({
              fecha: editando.fecha,
              alimento_id: editando.alimento_id,
              proveedor_id: editando.proveedor_id || null,
              ubicacion_id: editando.ubicacion_id || null,
              bolson_id: editando.bolson_id || null,
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

  async function borrarMovimiento(f: FilaHistorial) {
    setBorrando(true);
    const supabase = createClient();
    await supabase.from(f.tipo === "salida" ? "entregas" : "entradas_alimentos").delete().eq("id", f.id);
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
      "Alimento": f.alimento_nombre,
      "Tipo": f.tipo === "entrada" ? "Entrada" : "Salida",
      "Proveedor": f.proveedor_nombre ?? "",
      "Lote destino": f.lote_nombre ?? "",
      "Ubicación": f.ubicacion_nombre ?? "",
      "Bolsón": f.bolson_nombre ?? "",
      "Cantidad": f.cantidad,
      "Unidad": f.unidad,
      "Cargado por": f.cargado_por_nombre,
      "Observaciones": f.observaciones ?? "",
      "Cargado el": new Date(f.created_at).toLocaleString("es-AR", { hour12: false }),
    }));

    const hoja = XLSX.utils.json_to_sheet(datos);
    hoja["!cols"] = [
      { wch: 13 }, { wch: 20 }, { wch: 10 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 14 },
      { wch: 10 }, { wch: 10 }, { wch: 18 }, { wch: 30 }, { wch: 18 },
    ];
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Movimientos");

    const hoy = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(libro, `historial-alimentos-${hoy}.xlsx`);
  }

  const hayFiltrosActivos = !!(
    filtroAlimento || filtroTipo || filtroUbicacion || filtroBolson || filtroUsuario || filtroDesde || filtroHasta
  );

  const controlesFiltro = (
    <>
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
        value={filtroTipo}
        onChange={(e) => setFiltroTipo(e.target.value)}
        className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm"
      >
        <option value="">Entradas y salidas</option>
        <option value="entrada">Sólo entradas</option>
        <option value="salida">Sólo salidas</option>
      </select>

      <select
        value={filtroUbicacion}
        onChange={(e) => setFiltroUbicacion(e.target.value)}
        className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm"
      >
        <option value="">Todas las ubicaciones</option>
        {ubicaciones.map((u) => (
          <option key={u.id} value={u.id}>{u.nombre}</option>
        ))}
      </select>

      <select
        value={filtroBolson}
        onChange={(e) => setFiltroBolson(e.target.value)}
        className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm"
      >
        <option value="">Todos los bolsones</option>
        {bolsones.map((b) => (
          <option key={b.id} value={b.id}>{b.nombre}</option>
        ))}
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
            setFiltroAlimento("");
            setFiltroTipo("");
            setFiltroUbicacion("");
            setFiltroBolson("");
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
      {/* Filtros — escritorio: barra fija, igual que en la grilla de materiales */}
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
                        onClick={(e) => abrirMenu(e, f.id)}
                        className="-mr-1 rounded px-2 py-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                        aria-label="Más acciones"
                      >
                        ⋮
                      </button>
                    )}
                  </div>
                  {puedeEditar && menuAbierto === f.id && menuPos && (
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
                            <p className="mb-2 text-xs text-stone-600">¿Borrar este movimiento?</p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setConfirmandoBorrado(null)}
                                className="flex-1 rounded bg-stone-100 px-2 py-1 text-xs hover:bg-stone-200"
                              >
                                No
                              </button>
                              <button
                                onClick={() => borrarMovimiento(f)}
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
                  <p><span className="text-stone-500">Alimento:</span> {f.alimento_nombre}</p>
                  <p><span className="text-stone-500">Cantidad:</span> {f.cantidad} {f.unidad}</p>
                  <p>{detalle(f)}</p>
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
        <table className="w-full min-w-[860px] text-sm">
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
              <th className="px-4 py-2.5 font-medium">Alimento</th>
              <th className="px-4 py-2.5 font-medium">Tipo</th>
              <th className="px-4 py-2.5 font-medium">Detalle</th>
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
                  <td className="px-4 py-2.5">{f.alimento_nombre}</td>
                  <td className="px-4 py-2.5">{badgeTipo(f.tipo)}</td>
                  <td className="px-4 py-2.5 text-stone-500">{detalle(f)}</td>
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
                              <p className="mb-2 text-xs text-stone-600">¿Borrar este movimiento?</p>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setConfirmandoBorrado(null)}
                                  className="flex-1 rounded bg-stone-100 px-2 py-1 text-xs hover:bg-stone-200"
                                >
                                  No
                                </button>
                                <button
                                  onClick={() => borrarMovimiento(f)}
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
            <h2 className="text-lg font-bold text-stone-900">
              Editar {editando.kind === "salida" ? "entrega" : "entrada"}
            </h2>

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
              <label className="block text-sm font-medium text-stone-700">Alimento</label>
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

            {editando.kind === "salida" ? (
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
            ) : (
              <div>
                <label className="block text-sm font-medium text-stone-700">Proveedor (opcional)</label>
                <select
                  value={editando.proveedor_id}
                  onChange={(e) => setEditando({ ...editando, proveedor_id: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-base focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
                >
                  <option value="">Sin especificar</option>
                  {proveedores.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-stone-700">Ubicación</label>
              <select
                value={editando.ubicacion_id}
                onChange={(e) => setEditando({ ...editando, ubicacion_id: e.target.value })}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-base focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
              >
                <option value="">Sin especificar</option>
                {ubicaciones.map((u) => (
                  <option key={u.id} value={u.id}>{u.nombre}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700">Bolsón</label>
              <select
                value={editando.bolson_id}
                onChange={(e) => setEditando({ ...editando, bolson_id: e.target.value })}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-base focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
              >
                <option value="">Sin especificar</option>
                {bolsones.map((b) => (
                  <option key={b.id} value={b.id}>{b.nombre}</option>
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

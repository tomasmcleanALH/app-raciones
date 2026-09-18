"use client";

import { useCallback, useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";
import type { Alimento, BolsonAlimento, ProveedorAlimento, UbicacionAlimento } from "@/lib/types";

const SIN_CATEGORIA = "Sin categoría";
const SIN_UBICACION = "Sin ubicación";

interface FilaStock {
  categoria: string;
  alimento: string;
  ubicacion: string;
  bolson: string | null;
  unidad: string;
  total: number;
}

/** Rollos e insumos se controlan por total (sin ubicación ni bolsón);
 * el resto (ej. maíz picado) se sigue desglosando por dónde está. */
function esCategoriaTotal(categoria: string | null | undefined) {
  return !!categoria && /rollo|insumo/i.test(categoria);
}

function hoyISO() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

/** Stock disponible = entradas menos entregas, agrupado por alimento (y por
 * unidad, por si el mismo alimento se cargó alguna vez con otra unidad). */
export default function StockDisponibleAlimentos({
  campoId,
  userId,
  puedeAdministrar,
}: {
  campoId: string;
  userId: string;
  puedeAdministrar: boolean;
}) {
  const [stock, setStock] = useState<FilaStock[]>([]);
  const [cargando, setCargando] = useState(true);

  const [agregando, setAgregando] = useState(false);
  const [alimentos, setAlimentos] = useState<(Alimento & { categorias_alimentos: { nombre: string } | null })[]>([]);
  const [proveedores, setProveedores] = useState<ProveedorAlimento[]>([]);
  const [ubicaciones, setUbicaciones] = useState<UbicacionAlimento[]>([]);
  const [bolsones, setBolsones] = useState<BolsonAlimento[]>([]);
  const [fecha, setFecha] = useState(hoyISO());
  const [alimentoId, setAlimentoId] = useState("");
  const [proveedorId, setProveedorId] = useState("");
  const [ubicacionId, setUbicacionId] = useState("");
  const [bolsonId, setBolsonId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [unidad, setUnidad] = useState("kg");
  const [observaciones, setObservaciones] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [errorAgregar, setErrorAgregar] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    const supabase = createClient();
    const [{ data: entradas }, { data: entregas }] = await Promise.all([
      supabase
        .from("entradas_alimentos")
        .select("cantidad, unidad, alimentos!inner(nombre, campo_id, categorias_alimentos(nombre)), ubicaciones_alimentos(nombre), bolsones_alimentos(nombre)")
        .eq("alimentos.campo_id", campoId),
      supabase
        .from("entregas")
        .select("cantidad, unidad, lotes!inner(campo_id), alimentos(nombre, categorias_alimentos(nombre)), ubicaciones_alimentos(nombre), bolsones_alimentos(nombre)")
        .eq("lotes.campo_id", campoId),
    ]);

    const mapa = new Map<string, FilaStock>();
    function sumar(categoria: string, alimento: string, ubicacion: string, bolson: string | null, unidad: string, delta: number) {
      if (esCategoriaTotal(categoria)) {
        ubicacion = "";
        bolson = null;
      }
      const clave = `${categoria}|${alimento}|${ubicacion}|${bolson ?? ""}|${unidad}`;
      const actual = mapa.get(clave);
      if (actual) actual.total += delta;
      else mapa.set(clave, { categoria, alimento, ubicacion, bolson, unidad, total: delta });
    }

    for (const e of (entradas ?? []) as any[]) {
      sumar(
        e.alimentos?.categorias_alimentos?.nombre ?? SIN_CATEGORIA,
        e.alimentos?.nombre ?? "—",
        e.ubicaciones_alimentos?.nombre ?? SIN_UBICACION,
        e.bolsones_alimentos?.nombre ?? null,
        e.unidad,
        Number(e.cantidad),
      );
    }
    for (const s of (entregas ?? []) as any[]) {
      sumar(
        s.alimentos?.categorias_alimentos?.nombre ?? SIN_CATEGORIA,
        s.alimentos?.nombre ?? "—",
        s.ubicaciones_alimentos?.nombre ?? SIN_UBICACION,
        s.bolsones_alimentos?.nombre ?? null,
        s.unidad,
        -Number(s.cantidad),
      );
    }
    setStock(
      [...mapa.values()].sort(
        (a, b) =>
          a.categoria.localeCompare(b.categoria) ||
          a.alimento.localeCompare(b.alimento) ||
          a.ubicacion.localeCompare(b.ubicacion) ||
          (a.bolson ?? "").localeCompare(b.bolson ?? ""),
      ),
    );
    setCargando(false);
  }, [campoId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function abrirAgregar() {
    setErrorAgregar(null);
    setFecha(hoyISO());
    setAlimentoId("");
    setProveedorId("");
    setUbicacionId("");
    setBolsonId("");
    setCantidad("");
    setUnidad("kg");
    setObservaciones("");
    setAgregando(true);

    const supabase = createClient();
    Promise.all([
      supabase.from("alimentos").select("*, categorias_alimentos(nombre)").eq("campo_id", campoId).eq("activo", true).order("nombre"),
      supabase.from("proveedores_alimentos").select("*").eq("campo_id", campoId).eq("activo", true).order("nombre"),
      supabase.from("ubicaciones_alimentos").select("*").eq("campo_id", campoId).eq("activo", true).order("nombre"),
      supabase.from("bolsones_alimentos").select("*").eq("campo_id", campoId).eq("activo", true).order("nombre"),
    ]).then(([a, p, u, b]) => {
      setAlimentos((a.data ?? []) as typeof alimentos);
      setProveedores((p.data ?? []) as ProveedorAlimento[]);
      setUbicaciones((u.data ?? []) as UbicacionAlimento[]);
      setBolsones((b.data ?? []) as BolsonAlimento[]);
    });
  }

  const porTotal = esCategoriaTotal(alimentos.find((a) => a.id === alimentoId)?.categorias_alimentos?.nombre);

  async function guardarEntrada(e: React.FormEvent) {
    e.preventDefault();
    if (!alimentoId || !cantidad || (!porTotal && !ubicacionId)) return;
    setEnviando(true);
    setErrorAgregar(null);

    const supabase = createClient();
    const { error } = await supabase.from("entradas_alimentos").insert({
      fecha,
      alimento_id: alimentoId,
      cantidad: Number(cantidad),
      unidad,
      proveedor_id: proveedorId || null,
      ubicacion_id: porTotal ? null : ubicacionId,
      bolson_id: porTotal ? null : bolsonId || null,
      observaciones: observaciones.trim() || null,
      cargado_por: userId,
    });

    setEnviando(false);

    if (error) {
      setErrorAgregar(error.message);
      return;
    }

    setAgregando(false);
    cargar();
  }

  function exportarExcel() {
    if (stock.length === 0) return;

    const datos = stock.map((r) => ({
      "Categoría": r.categoria,
      "Alimento": r.alimento,
      "Ubicación": r.ubicacion || "—",
      "Bolsón": r.bolson ?? "—",
      "Disponible": r.total,
      "Unidad": r.unidad,
    }));

    const hoja = XLSX.utils.json_to_sheet(datos);
    hoja["!cols"] = [{ wch: 18 }, { wch: 24 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 10 }];
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Stock disponible");

    const hoy = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(libro, `stock-alimentos-${hoy}.xlsx`);
  }

  const stockPorCategoria = new Map<string, FilaStock[]>();
  for (const fila of stock) {
    const lista = stockPorCategoria.get(fila.categoria) ?? [];
    lista.push(fila);
    stockPorCategoria.set(fila.categoria, lista);
  }
  const categoriasOrdenadas = [...stockPorCategoria.entries()].sort(([a], [b]) => {
    if (a === SIN_CATEGORIA) return 1;
    if (b === SIN_CATEGORIA) return -1;
    return a.localeCompare(b);
  });

  const botonActualizar = (
    <button
      onClick={cargar}
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

  const botonExportar = (
    <button
      onClick={exportarExcel}
      disabled={stock.length === 0}
      title="Exportar a Excel"
      aria-label="Exportar a Excel"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1D6F42] text-white hover:bg-[#175c37] disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M4 9h16M4 15h16M10 3v18M14 3v18" strokeWidth="1.1" opacity="0.65" />
      </svg>
    </button>
  );

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-stone-700">Stock disponible</h2>
        <div className="flex gap-2">
          {puedeAdministrar && (
            <button
              onClick={abrirAgregar}
              className="rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800"
            >
              Agregar stock
            </button>
          )}
          {botonActualizar}
          {botonExportar}
        </div>
      </div>

      {cargando ? (
        <p className="text-sm text-stone-400">Cargando...</p>
      ) : stock.length === 0 ? (
        <p className="text-sm text-stone-400">Todavía no hay movimientos cargados.</p>
      ) : (
        <div className="space-y-4">
          {categoriasOrdenadas.map(([categoria, filas]) => (
            <div key={categoria}>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-400">{categoria}</h3>
              <ul className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                {filas.map((r) => (
                  <li
                    key={`${r.alimento}|${r.ubicacion}|${r.bolson}|${r.unidad}`}
                    className="flex items-baseline justify-between gap-3 border-b border-stone-100 py-1.5 text-sm"
                  >
                    <span className="text-stone-600">
                      {r.alimento}
                      {r.ubicacion && (
                        <span className="text-stone-400">
                          {" "}— {r.ubicacion}
                          {r.bolson ? ` · Bolsón: ${r.bolson}` : ""}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 font-semibold text-stone-900">
                      {r.total.toLocaleString("es-AR", { maximumFractionDigits: 2 })} {r.unidad}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {agregando && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
          <form
            onSubmit={guardarEntrada}
            className="w-full max-w-sm space-y-4 rounded-xl bg-white p-5 shadow-xl"
          >
            <h2 className="text-lg font-bold text-stone-900">Agregar stock</h2>

            <div>
              <label className="block text-sm font-medium text-stone-700">Fecha</label>
              <input
                type="date"
                required
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-base focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700">Alimento</label>
              <select
                required
                value={alimentoId}
                onChange={(e) => setAlimentoId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-base focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
              >
                <option value="" disabled>Elegir...</option>
                {alimentos.map((a) => (
                  <option key={a.id} value={a.id}>{a.nombre}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700">Proveedor (opcional)</label>
              <select
                value={proveedorId}
                onChange={(e) => setProveedorId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-base focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
              >
                <option value="">Sin especificar</option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>

            {!porTotal && (
            <div>
              <label className="block text-sm font-medium text-stone-700">Ubicación</label>
              <select
                required
                value={ubicacionId}
                onChange={(e) => setUbicacionId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-base focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
              >
                <option value="" disabled>Elegir...</option>
                {ubicaciones.map((u) => (
                  <option key={u.id} value={u.id}>{u.nombre}</option>
                ))}
              </select>
            </div>
            )}

            {!porTotal && bolsones.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-stone-700">Bolsón (opcional)</label>
                <select
                  value={bolsonId}
                  onChange={(e) => setBolsonId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-base focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
                >
                  <option value="">Sin especificar</option>
                  {bolsones.map((b) => (
                    <option key={b.id} value={b.id}>{b.nombre}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-stone-700">Cantidad</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  required
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-base focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
                />
              </div>
              <div className="w-28">
                <label className="block text-sm font-medium text-stone-700">Unidad</label>
                <select
                  value={unidad}
                  onChange={(e) => setUnidad(e.target.value)}
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
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-base focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
              />
            </div>

            {errorAgregar && <p className="text-sm text-red-600">{errorAgregar}</p>}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setAgregando(false)}
                disabled={enviando}
                className="flex-1 rounded-lg border border-stone-300 px-4 py-2.5 font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={enviando}
                className="flex-1 rounded-lg bg-brand-700 px-4 py-2.5 font-medium text-white hover:bg-brand-800 disabled:opacity-60"
              >
                {enviando ? "Guardando..." : "Agregar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

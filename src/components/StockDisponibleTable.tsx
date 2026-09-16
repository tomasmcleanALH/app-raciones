"use client";

import { useCallback, useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";
import type { TipoMovimiento } from "@/lib/types";

const SIN_CATEGORIA = "Sin categoría";

interface FilaStock {
  categoria: string;
  material: string;
  unidad: string;
  total: number;
}

/** Stock disponible = entradas menos salidas, agrupado por material (y por
 * unidad, por si el mismo material se cargó alguna vez con otra unidad). */
export default function StockDisponibleTable({ campoId }: { campoId: string }) {
  const [stock, setStock] = useState<FilaStock[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("movimientos_stock")
      .select("material_id, tipo, cantidad, unidad, materiales!inner(nombre, campo_id, categorias_materiales(nombre))")
      .eq("materiales.campo_id", campoId);

    const mapa = new Map<string, FilaStock>();
    for (const m of (data ?? []) as any[]) {
      const categoria = m.materiales?.categorias_materiales?.nombre ?? SIN_CATEGORIA;
      const nombre = m.materiales?.nombre ?? "—";
      const clave = `${categoria}|${nombre}|${m.unidad}`;
      const signo: TipoMovimiento = m.tipo;
      const cantidad = (signo === "entrada" ? 1 : -1) * Number(m.cantidad);
      const actual = mapa.get(clave);
      if (actual) actual.total += cantidad;
      else mapa.set(clave, { categoria, material: nombre, unidad: m.unidad, total: cantidad });
    }
    setStock(
      [...mapa.values()].sort(
        (a, b) => a.categoria.localeCompare(b.categoria) || a.material.localeCompare(b.material),
      ),
    );
    setCargando(false);
  }, [campoId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function exportarExcel() {
    if (stock.length === 0) return;

    const datos = stock.map((r) => ({
      "Categoría": r.categoria,
      "Material": r.material,
      "Disponible": r.total,
      "Unidad": r.unidad,
    }));

    const hoja = XLSX.utils.json_to_sheet(datos);
    hoja["!cols"] = [{ wch: 18 }, { wch: 24 }, { wch: 12 }, { wch: 10 }];
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Stock disponible");

    const hoy = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(libro, `stock-disponible-${hoy}.xlsx`);
  }

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

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-stone-700">Stock disponible</h2>
        <div className="flex gap-2">
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
                  <li key={`${r.material}|${r.unidad}`} className="flex items-baseline justify-between gap-3 border-b border-stone-100 py-1.5 text-sm">
                    <span className="text-stone-600">{r.material}</span>
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
    </div>
  );
}

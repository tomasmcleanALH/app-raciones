"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Item {
  id: string;
  nombre: string;
  activo: boolean;
  categoria_id?: string | null;
}

interface Categoria {
  id: string;
  nombre: string;
}

interface Props {
  tabla:
    | "lotes"
    | "alimentos"
    | "proveedores_alimentos"
    | "ubicaciones_alimentos"
    | "bolsones_alimentos"
    | "categorias_alimentos"
    | "materiales"
    | "proveedores"
    | "contratistas"
    | "lotes_materiales"
    | "categorias_materiales";
  titulo: string;
  /** Campo al que pertenecen (y al que se asigna lo que se agregue acá). */
  campoId: string;
  /** true = sólo puede ver la lista (rol Gerente); no agrega, edita, borra ni desactiva. */
  soloLectura?: boolean;
  /** Sólo para "alimentos"/"materiales": catálogo de categorías para asignarle una a cada item. */
  categorias?: Categoria[];
}

const SINGULAR: Record<Props["tabla"], string> = {
  lotes: "el lote",
  alimentos: "el alimento",
  proveedores_alimentos: "el proveedor",
  ubicaciones_alimentos: "la ubicación",
  bolsones_alimentos: "el bolsón",
  categorias_alimentos: "la categoría",
  materiales: "el material",
  proveedores: "el proveedor",
  contratistas: "el contratista",
  lotes_materiales: "el lote",
  categorias_materiales: "la categoría",
};

/** Frases para los mensajes de borrado/desactivado, según qué usa cada catálogo. */
const USO: Record<Props["tabla"], { nueva: string; ninguna: string; alguna: string }> = {
  lotes: { nueva: "una entrega nueva", ninguna: "ninguna entrega", alguna: "alguna entrega" },
  alimentos: { nueva: "una entrada o entrega nueva", ninguna: "ninguna entrada ni entrega", alguna: "alguna entrada o entrega" },
  proveedores_alimentos: { nueva: "una entrada nueva", ninguna: "ninguna entrada", alguna: "alguna entrada de alimento" },
  ubicaciones_alimentos: { nueva: "una entrada o entrega nueva", ninguna: "ninguna entrada ni entrega", alguna: "alguna entrada o entrega" },
  bolsones_alimentos: { nueva: "una entrada o entrega nueva", ninguna: "ninguna entrada ni entrega", alguna: "alguna entrada o entrega" },
  categorias_alimentos: { nueva: "un alimento nuevo", ninguna: "ningún alimento", alguna: "algún alimento" },
  materiales: { nueva: "un movimiento nuevo", ninguna: "ningún movimiento", alguna: "algún movimiento de stock" },
  proveedores: { nueva: "un movimiento nuevo", ninguna: "ningún movimiento", alguna: "algún movimiento de stock" },
  contratistas: { nueva: "un movimiento nuevo", ninguna: "ningún movimiento", alguna: "algún movimiento de stock" },
  lotes_materiales: { nueva: "un movimiento nuevo", ninguna: "ningún movimiento", alguna: "algún movimiento de stock" },
  categorias_materiales: { nueva: "un material nuevo", ninguna: "ningún material", alguna: "algún material" },
};

/** CRUD simple y genérico para "lotes"/"alimentos"/"proveedores_alimentos"/
 * "ubicaciones_alimentos"/"categorias_alimentos" (módulo Alimentos) y
 * "materiales"/"proveedores"/"contratistas"/"lotes_materiales"/
 * "categorias_materiales" (módulo Stock de materiales) — mismo formato.
 * Cuando se pasa `categorias`, el alta y la edición de cada item piden
 * también a qué categoría pertenece (para agrupar el Stock disponible). */
export default function CatalogoAdmin({ tabla, titulo, campoId, soloLectura = false, categorias }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [categoriaNueva, setCategoriaNueva] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [menuAbierto, setMenuAbierto] = useState<string | null>(null);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState<string | null>(null);
  const [errorBorrado, setErrorBorrado] = useState<string | null>(null);
  const [borrando, setBorrando] = useState<string | null>(null);

  const [editando, setEditando] = useState<Item | null>(null);
  const [nombreEditado, setNombreEditado] = useState("");
  const [categoriaEditada, setCategoriaEditada] = useState("");
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [errorEdicion, setErrorEdicion] = useState<string | null>(null);

  async function recargar() {
    const supabase = createClient();
    const { data, error } = await supabase.from(tabla).select("*").eq("campo_id", campoId).order("nombre");
    if (error) setError(error.message);
    else setItems((data ?? []) as Item[]);
    setCargando(false);
  }

  useEffect(() => {
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabla, campoId]);

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    if (!nombreNuevo.trim()) return;
    const supabase = createClient();
    const payload: Record<string, unknown> = { nombre: nombreNuevo.trim(), campo_id: campoId };
    if (categorias) payload.categoria_id = categoriaNueva || null;
    const { error } = await supabase.from(tabla).insert(payload);
    if (error) {
      setError(error.message.includes("duplicate") ? "Ya existe uno con ese nombre." : error.message);
      return;
    }
    setNombreNuevo("");
    setCategoriaNueva("");
    setError(null);
    recargar();
  }

  async function toggleActivo(item: Item) {
    setMenuAbierto(null);
    const supabase = createClient();
    await supabase.from(tabla).update({ activo: !item.activo }).eq("id", item.id);
    recargar();
  }

  function abrirEdicion(item: Item) {
    setMenuAbierto(null);
    setErrorEdicion(null);
    setEditando(item);
    setNombreEditado(item.nombre);
    setCategoriaEditada(item.categoria_id ?? "");
  }

  async function guardarEdicion(e: React.FormEvent) {
    e.preventDefault();
    if (!editando || !nombreEditado.trim()) return;
    setGuardandoEdicion(true);
    setErrorEdicion(null);

    const payload: Record<string, unknown> = { nombre: nombreEditado.trim() };
    if (categorias) payload.categoria_id = categoriaEditada || null;

    const supabase = createClient();
    const { error } = await supabase
      .from(tabla)
      .update(payload)
      .eq("id", editando.id);

    setGuardandoEdicion(false);

    if (error) {
      setErrorEdicion(error.message.includes("duplicate") ? "Ya existe uno con ese nombre." : error.message);
      return;
    }

    setEditando(null);
    recargar();
  }

  async function borrar(item: Item) {
    setErrorBorrado(null);
    setBorrando(item.id);
    const supabase = createClient();
    const { error } = await supabase.from(tabla).delete().eq("id", item.id);
    setBorrando(null);
    setConfirmandoBorrado(null);
    setMenuAbierto(null);

    if (error) {
      // 23503 = violación de llave foránea: ya se usó en alguna entrega/entrada/movimiento.
      setErrorBorrado(
        error.code === "23503"
          ? `No se puede borrar "${item.nombre}": ya se usó en ${USO[tabla].alguna}. Desactivalo en cambio.`
          : error.message,
      );
      return;
    }
    recargar();
  }

  const singular = SINGULAR[tabla];

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-4 text-xl font-bold text-stone-900">{titulo}</h1>

      {!soloLectura && (
        <form onSubmit={agregar} className="mb-4 space-y-2">
          <input
            value={nombreNuevo}
            onChange={(e) => setNombreNuevo(e.target.value)}
            placeholder="Nombre nuevo..."
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-base focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
          />
          <div className="flex flex-wrap gap-2">
            {categorias && (
              <select
                value={categoriaNueva}
                onChange={(e) => setCategoriaNueva(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-stone-300 px-3 py-2 text-base focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
              >
                <option value="">Sin categoría</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            )}
            <button type="submit" className="rounded-lg bg-brand-700 px-4 py-2 font-medium text-white hover:bg-brand-800">
              Agregar
            </button>
          </div>
        </form>
      )}

      {error && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {errorBorrado && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{errorBorrado}</p>}

      <div className="overflow-visible rounded-xl bg-white shadow-sm ring-1 ring-stone-200">
        {cargando ? (
          <p className="p-4 text-sm text-stone-400">Cargando...</p>
        ) : items.length === 0 ? (
          <p className="p-4 text-sm text-stone-400">Todavía no hay nada cargado.</p>
        ) : (
          <ul>
            {items.map((item) => (
              <li key={item.id} className="border-b border-stone-100 px-4 py-3 last:border-0">
                <div className="flex items-center justify-between">
                  <span className={item.activo ? "" : "opacity-40"}>
                    {item.nombre}
                    {categorias && (
                      <span className="ml-2 text-xs text-stone-400">
                        · {categorias.find((c) => c.id === item.categoria_id)?.nombre ?? "Sin categoría"}
                      </span>
                    )}
                  </span>

                  {!soloLectura && (
                  <div className="relative">
                    <button
                      onClick={() => {
                        setConfirmandoBorrado(null);
                        setMenuAbierto(menuAbierto === item.id ? null : item.id);
                      }}
                      className="rounded px-2 py-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                      aria-label="Más acciones"
                    >
                      ⋮
                    </button>

                    {menuAbierto === item.id && (
                      <>
                        <button
                          className="fixed inset-0 z-10 cursor-default"
                          onClick={() => setMenuAbierto(null)}
                          aria-label="Cerrar menú"
                        />
                        <div className="absolute right-0 top-full z-20 w-40 rounded-lg bg-white py-1 text-left shadow-lg ring-1 ring-stone-200">
                          {confirmandoBorrado === item.id ? (
                            <div className="px-3 py-2">
                              <p className="mb-2 text-xs text-stone-600">
                                ¿Borrar {singular} para siempre?
                              </p>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setConfirmandoBorrado(null)}
                                  className="flex-1 rounded bg-stone-100 px-2 py-1 text-xs hover:bg-stone-200"
                                >
                                  No
                                </button>
                                <button
                                  onClick={() => borrar(item)}
                                  disabled={borrando === item.id}
                                  className="flex-1 rounded bg-red-700 px-2 py-1 text-xs text-white hover:bg-red-800 disabled:opacity-60"
                                >
                                  {borrando === item.id ? "..." : "Sí"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => abrirEdicion(item)}
                                className="block w-full px-3 py-2 text-left text-sm text-stone-700 hover:bg-stone-50"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => toggleActivo(item)}
                                className="block w-full px-3 py-2 text-left text-sm text-stone-700 hover:bg-stone-50"
                              >
                                {item.activo ? "Desactivar" : "Activar"}
                              </button>
                              <button
                                onClick={() => setConfirmandoBorrado(item.id)}
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
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {!soloLectura && (
      <p className="mt-2 text-xs text-stone-400">
        Desactivar no borra el historial: sólo deja de aparecer como opción al cargar {USO[tabla].nueva}. Borrar es
        permanente y sólo se puede hacer si todavía no se usó en {USO[tabla].ninguna}.
      </p>
      )}

      {editando && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
          <form
            onSubmit={guardarEdicion}
            className="w-full max-w-sm space-y-4 rounded-xl bg-white p-5 shadow-xl"
          >
            <h2 className="text-lg font-bold text-stone-900">Editar {singular}</h2>

            <input
              value={nombreEditado}
              onChange={(e) => setNombreEditado(e.target.value)}
              required
              autoFocus
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-base focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
            />

            {categorias && (
              <div>
                <label className="block text-sm font-medium text-stone-700">Categoría</label>
                <select
                  value={categoriaEditada}
                  onChange={(e) => setCategoriaEditada(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-base focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
                >
                  <option value="">Sin categoría</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
            )}

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

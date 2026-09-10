"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Item {
  id: string;
  nombre: string;
  activo: boolean;
}

/** CRUD simple y genérico para las tablas "lotes" y "alimentos" (mismo formato). */
export default function CatalogoAdmin({ tabla, titulo }: { tabla: "lotes" | "alimentos"; titulo: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [confirmandoBorrado, setConfirmandoBorrado] = useState<string | null>(null);
  const [errorBorrado, setErrorBorrado] = useState<string | null>(null);
  const [borrando, setBorrando] = useState<string | null>(null);

  async function recargar() {
    const supabase = createClient();
    const { data, error } = await supabase.from(tabla).select("*").order("nombre");
    if (error) setError(error.message);
    else setItems((data ?? []) as Item[]);
    setCargando(false);
  }

  useEffect(() => {
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabla]);

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    if (!nombreNuevo.trim()) return;
    const supabase = createClient();
    const { error } = await supabase.from(tabla).insert({ nombre: nombreNuevo.trim() });
    if (error) {
      setError(error.message.includes("duplicate") ? "Ya existe uno con ese nombre." : error.message);
      return;
    }
    setNombreNuevo("");
    setError(null);
    recargar();
  }

  async function toggleActivo(item: Item) {
    const supabase = createClient();
    await supabase.from(tabla).update({ activo: !item.activo }).eq("id", item.id);
    recargar();
  }

  async function borrar(item: Item) {
    setErrorBorrado(null);
    setBorrando(item.id);
    const supabase = createClient();
    const { error } = await supabase.from(tabla).delete().eq("id", item.id);
    setBorrando(null);
    setConfirmandoBorrado(null);

    if (error) {
      // 23503 = violación de llave foránea: ya hay entregas que usan este lote/alimento.
      setErrorBorrado(
        error.code === "23503"
          ? `No se puede borrar "${item.nombre}": ya se usó en alguna entrega. Desactivalo en cambio.`
          : error.message,
      );
      return;
    }
    recargar();
  }

  const singular = tabla === "lotes" ? "el lote" : "el alimento";

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-4 text-xl font-bold text-stone-900">{titulo}</h1>

      <form onSubmit={agregar} className="mb-4 flex gap-2">
        <input
          value={nombreNuevo}
          onChange={(e) => setNombreNuevo(e.target.value)}
          placeholder="Nombre nuevo..."
          className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-base focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
        />
        <button type="submit" className="rounded-lg bg-brand-700 px-4 py-2 font-medium text-white hover:bg-brand-800">
          Agregar
        </button>
      </form>

      {error && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {errorBorrado && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{errorBorrado}</p>}

      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-stone-200">
        {cargando ? (
          <p className="p-4 text-sm text-stone-400">Cargando...</p>
        ) : items.length === 0 ? (
          <p className="p-4 text-sm text-stone-400">Todavía no hay nada cargado.</p>
        ) : (
          <ul>
            {items.map((item) => (
              <li key={item.id} className="border-b border-stone-100 px-4 py-3 last:border-0">
                <div className="flex items-center justify-between">
                  <span className={item.activo ? "" : "text-stone-400 line-through"}>{item.nombre}</span>
                  {confirmandoBorrado !== item.id && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleActivo(item)}
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          item.activo ? "bg-stone-100 text-stone-600 hover:bg-stone-200" : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {item.activo ? "Desactivar" : "Activar"}
                      </button>
                      <button
                        onClick={() => {
                          setErrorBorrado(null);
                          setConfirmandoBorrado(item.id);
                        }}
                        className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                      >
                        Borrar
                      </button>
                    </div>
                  )}
                </div>

                {confirmandoBorrado === item.id && (
                  <div className="mt-2 flex items-center justify-between rounded-lg bg-red-50 px-3 py-2">
                    <span className="text-xs text-red-800">
                      ¿Borrar {singular} &quot;{item.nombre}&quot; para siempre?
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setConfirmandoBorrado(null)}
                        className="rounded-full bg-white px-3 py-1 text-xs font-medium text-stone-600 hover:bg-stone-100"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => borrar(item)}
                        disabled={borrando === item.id}
                        className="rounded-full bg-red-700 px-3 py-1 text-xs font-medium text-white hover:bg-red-800 disabled:opacity-60"
                      >
                        {borrando === item.id ? "Borrando..." : "Sí, borrar"}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-2 text-xs text-stone-400">
        Desactivar no borra el historial: sólo deja de aparecer como opción al cargar una entrega nueva.
        Borrar es permanente y sólo se puede hacer si todavía no se usó en ninguna entrega.
      </p>
    </div>
  );
}

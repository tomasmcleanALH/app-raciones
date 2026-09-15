"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Campo } from "@/lib/types";

interface Fila extends Campo {
  materialesHabilitado: boolean;
}

export default function CamposAdmin() {
  const [items, setItems] = useState<Fila[]>([]);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [menuAbierto, setMenuAbierto] = useState<string | null>(null);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState<string | null>(null);
  const [errorBorrado, setErrorBorrado] = useState<string | null>(null);
  const [borrando, setBorrando] = useState<string | null>(null);

  const [editando, setEditando] = useState<Campo | null>(null);
  const [nombreEditado, setNombreEditado] = useState("");
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [errorEdicion, setErrorEdicion] = useState<string | null>(null);

  async function recargar() {
    const supabase = createClient();
    const [{ data, error }, { data: modulos }] = await Promise.all([
      supabase.from("campos").select("*").order("nombre"),
      supabase.from("campo_modulos").select("campo_id, modulo").eq("modulo", "materiales"),
    ]);
    if (error) setError(error.message);
    else {
      const conMateriales = new Set((modulos ?? []).map((m: any) => m.campo_id));
      setItems(((data ?? []) as Campo[]).map((c) => ({ ...c, materialesHabilitado: conMateriales.has(c.id) })));
    }
    setCargando(false);
  }

  useEffect(() => {
    recargar();
  }, []);

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    if (!nombreNuevo.trim()) return;
    const supabase = createClient();
    const { data, error } = await supabase.from("campos").insert({ nombre: nombreNuevo.trim() }).select().single();
    if (error) {
      setError(error.message.includes("duplicate") ? "Ya existe un campo con ese nombre." : error.message);
      return;
    }
    // Todo campo nuevo arranca con Alimentos habilitado (el comportamiento de siempre);
    // Materiales se prende aparte, por campo, con el interruptor de la lista.
    await supabase.from("campo_modulos").insert({ campo_id: data.id, modulo: "alimentos" });
    setNombreNuevo("");
    setError(null);
    recargar();
  }

  async function toggleActivo(item: Fila) {
    setMenuAbierto(null);
    const supabase = createClient();
    await supabase.from("campos").update({ activo: !item.activo }).eq("id", item.id);
    recargar();
  }

  async function toggleMateriales(item: Fila) {
    const supabase = createClient();
    if (item.materialesHabilitado) {
      await supabase.from("campo_modulos").delete().eq("campo_id", item.id).eq("modulo", "materiales");
    } else {
      await supabase.from("campo_modulos").insert({ campo_id: item.id, modulo: "materiales" });
    }
    recargar();
  }

  function abrirEdicion(item: Fila) {
    setMenuAbierto(null);
    setErrorEdicion(null);
    setEditando(item);
    setNombreEditado(item.nombre);
  }

  async function guardarEdicion(e: React.FormEvent) {
    e.preventDefault();
    if (!editando || !nombreEditado.trim()) return;
    setGuardandoEdicion(true);
    setErrorEdicion(null);

    const supabase = createClient();
    const { error } = await supabase
      .from("campos")
      .update({ nombre: nombreEditado.trim() })
      .eq("id", editando.id);

    setGuardandoEdicion(false);

    if (error) {
      setErrorEdicion(error.message.includes("duplicate") ? "Ya existe un campo con ese nombre." : error.message);
      return;
    }

    setEditando(null);
    recargar();
  }

  async function borrar(item: Campo) {
    setErrorBorrado(null);
    setBorrando(item.id);
    const supabase = createClient();
    const { error } = await supabase.from("campos").delete().eq("id", item.id);
    setBorrando(null);
    setConfirmandoBorrado(null);
    setMenuAbierto(null);

    if (error) {
      setErrorBorrado(
        error.code === "23503"
          ? `No se puede borrar "${item.nombre}": todavía tiene lotes, alimentos o usuarios cargados.`
          : error.message,
      );
      return;
    }
    recargar();
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-4 text-xl font-bold text-stone-900">Campos</h1>

      <form onSubmit={agregar} className="mb-4 flex gap-2">
        <input
          value={nombreNuevo}
          onChange={(e) => setNombreNuevo(e.target.value)}
          placeholder="Nombre del campo nuevo..."
          className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-base focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
        />
        <button type="submit" className="rounded-lg bg-brand-700 px-4 py-2 font-medium text-white hover:bg-brand-800">
          Agregar
        </button>
      </form>

      {error && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {errorBorrado && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{errorBorrado}</p>}

      <div className="overflow-visible rounded-xl bg-white shadow-sm ring-1 ring-stone-200">
        {cargando ? (
          <p className="p-4 text-sm text-stone-400">Cargando...</p>
        ) : items.length === 0 ? (
          <p className="p-4 text-sm text-stone-400">Todavía no hay ningún campo cargado.</p>
        ) : (
          <ul>
            {items.map((item) => (
              <li key={item.id} className="border-b border-stone-100 px-4 py-3 last:border-0">
                <div className="flex items-center justify-between gap-3">
                  <span className={item.activo ? "" : "opacity-40"}>{item.nombre}</span>

                  <div className="flex shrink-0 items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs text-stone-500">
                      <input
                        type="checkbox"
                        checked={item.materialesHabilitado}
                        onChange={() => toggleMateriales(item)}
                        className="h-3.5 w-3.5 rounded border-stone-300 accent-brand-700"
                      />
                      Stock de materiales
                    </label>

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
                              <p className="mb-2 text-xs text-stone-600">¿Borrar este campo?</p>
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
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-2 text-xs text-stone-400">
        Desactivar oculta el campo del selector, pero no borra nada. Borrar es permanente y sólo se
        puede hacer si el campo todavía no tiene lotes, alimentos ni usuarios cargados.
      </p>

      {editando && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
          <form
            onSubmit={guardarEdicion}
            className="w-full max-w-sm space-y-4 rounded-xl bg-white p-5 shadow-xl"
          >
            <h2 className="text-lg font-bold text-stone-900">Editar nombre</h2>

            <input
              value={nombreEditado}
              onChange={(e) => setNombreEditado(e.target.value)}
              required
              autoFocus
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-base focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
            />

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

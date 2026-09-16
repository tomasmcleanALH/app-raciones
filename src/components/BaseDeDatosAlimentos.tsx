"use client";

import { useEffect, useState } from "react";
import CatalogoAdmin from "./CatalogoAdmin";
import { createClient } from "@/lib/supabase/client";

const TABS = [
  { tabla: "alimentos", titulo: "Alimentos" },
  { tabla: "lotes", titulo: "Lotes" },
  { tabla: "proveedores_alimentos", titulo: "Proveedores" },
  { tabla: "ubicaciones_alimentos", titulo: "Ubicaciones" },
  { tabla: "categorias_alimentos", titulo: "Categorías" },
] as const;

type Tabla = (typeof TABS)[number]["tabla"];

/** Base de datos del módulo Alimentos: los catálogos que se usan al
 * cargar una entrega o una entrada, todos en un solo lugar con solapas
 * internas (igual que la Base de datos de Materiales). */
export default function BaseDeDatosAlimentos({ campoId, soloLectura }: { campoId: string; soloLectura: boolean }) {
  const [activa, setActiva] = useState<Tabla>("alimentos");
  const [categorias, setCategorias] = useState<{ id: string; nombre: string }[]>([]);
  const tabActiva = TABS.find((t) => t.tabla === activa)!;

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("categorias_alimentos")
      .select("id, nombre")
      .eq("campo_id", campoId)
      .order("nombre")
      .then(({ data }) => setCategorias(data ?? []));
  }, [campoId]);

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-stone-900">Base de datos</h1>

      <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-white p-1 shadow-sm ring-1 ring-stone-200">
        {TABS.map((t) => (
          <button
            key={t.tabla}
            onClick={() => setActiva(t.tabla)}
            className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
              activa === t.tabla ? "bg-brand-100 text-brand-800" : "text-stone-600 hover:bg-stone-100"
            }`}
          >
            {t.titulo}
          </button>
        ))}
      </div>

      <CatalogoAdmin
        key={tabActiva.tabla}
        tabla={tabActiva.tabla}
        titulo={tabActiva.titulo}
        campoId={campoId}
        soloLectura={soloLectura}
        categorias={tabActiva.tabla === "alimentos" ? categorias : undefined}
      />
    </div>
  );
}

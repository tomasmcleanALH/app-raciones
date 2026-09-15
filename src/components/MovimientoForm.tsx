"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getIsletasActivas, getMaterialesActivos } from "@/lib/offline/catalogos";
import type { Isleta, Material, TipoMovimiento } from "@/lib/types";

function hoyISO() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

export default function MovimientoForm({ userId, campoId }: { userId: string; campoId: string }) {
  const [isletas, setIsletas] = useState<Isleta[]>([]);
  const [materiales, setMateriales] = useState<Material[]>([]);
  const [cargandoCatalogos, setCargandoCatalogos] = useState(true);

  const [fecha, setFecha] = useState(hoyISO());
  const [tipo, setTipo] = useState<TipoMovimiento>("entrada");
  const [isletaId, setIsletaId] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [unidad, setUnidad] = useState("unidades");
  const [observaciones, setObservaciones] = useState("");

  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [revisando, setRevisando] = useState(false);

  useEffect(() => {
    Promise.all([getIsletasActivas(campoId), getMaterialesActivos(campoId)])
      .then(([i, m]) => {
        setIsletas(i);
        setMateriales(m);
      })
      .catch(() => {
        setMensaje({ tipo: "error", texto: "No se pudieron cargar las isletas/materiales. Volvé a intentar." });
      })
      .finally(() => setCargandoCatalogos(false));
  }, [campoId]);

  function limpiarFormulario() {
    setCantidad("");
    setObservaciones("");
    setRevisando(false);
  }

  function handlePasarARevision(e: React.FormEvent) {
    e.preventDefault();
    setMensaje(null);
    if (!isletaId || !materialId || !cantidad) return;
    setRevisando(true);
  }

  async function confirmarEnvio() {
    setMensaje(null);
    setEnviando(true);

    const supabase = createClient();
    const { error } = await supabase.from("movimientos_stock").insert({
      fecha,
      isleta_id: isletaId,
      material_id: materialId,
      tipo,
      cantidad: Number(cantidad),
      unidad,
      observaciones: observaciones.trim() || null,
      cargado_por: userId,
    });

    setEnviando(false);

    if (error) {
      setMensaje({ tipo: "error", texto: error.message });
      return;
    }

    setMensaje({ tipo: "ok", texto: tipo === "entrada" ? "Entrada registrada." : "Salida registrada." });
    limpiarFormulario();
  }

  if (cargandoCatalogos) {
    return <p className="text-sm text-stone-500">Cargando...</p>;
  }

  if (isletas.length === 0 || materiales.length === 0) {
    return (
      <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
        Todavía no hay isletas o materiales cargados. Pedile al administrador que los cree en
        Administración antes de registrar movimientos.
      </p>
    );
  }

  if (revisando) {
    const nombreMaterial = materiales.find((m) => m.id === materialId)?.nombre ?? "—";
    const nombreIsleta = isletas.find((i) => i.id === isletaId)?.nombre ?? "—";

    return (
      <div className="space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-stone-200">
        <h2 className="text-sm font-medium text-stone-500">Revisá antes de enviar</h2>

        <dl className="divide-y divide-stone-100 rounded-lg border border-stone-200">
          {[
            ["Fecha", fecha],
            ["Tipo", tipo === "entrada" ? "Entrada" : "Salida"],
            ["Material", nombreMaterial],
            ["Isleta", nombreIsleta],
            ["Cantidad", `${cantidad} ${unidad}`],
            ["Observaciones", observaciones.trim() || "—"],
          ].map(([label, valor]) => (
            <div key={label} className="flex justify-between px-4 py-2.5 text-sm">
              <dt className="text-stone-500">{label}</dt>
              <dd className="font-medium text-stone-900">{valor}</dd>
            </div>
          ))}
        </dl>

        {mensaje && (
          <p
            className={`rounded-lg p-3 text-sm ${
              mensaje.tipo === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"
            }`}
          >
            {mensaje.texto}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setRevisando(false)}
            disabled={enviando}
            className="flex-1 rounded-lg border border-stone-300 px-4 py-3 text-base font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-60"
          >
            Volver a editar
          </button>
          <button
            type="button"
            onClick={confirmarEnvio}
            disabled={enviando}
            className="flex-1 rounded-lg bg-brand-700 px-4 py-3 text-base font-medium text-white hover:bg-brand-800 disabled:opacity-60"
          >
            {enviando ? "Enviando..." : "Confirmar y enviar"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handlePasarARevision} className="space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-stone-200">
      <div>
        <label className="block text-sm font-medium text-stone-700">Tipo de movimiento</label>
        <div className="mt-1 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setTipo("entrada")}
            className={`rounded-lg border px-3 py-2.5 text-base font-medium ${
              tipo === "entrada"
                ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                : "border-stone-300 text-stone-600 hover:bg-stone-50"
            }`}
          >
            Entrada
          </button>
          <button
            type="button"
            onClick={() => setTipo("salida")}
            className={`rounded-lg border px-3 py-2.5 text-base font-medium ${
              tipo === "salida"
                ? "border-amber-600 bg-amber-50 text-amber-800"
                : "border-stone-300 text-stone-600 hover:bg-stone-50"
            }`}
          >
            Salida
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700">Fecha</label>
        <input
          type="date"
          required
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700">Material</label>
        <select
          required
          value={materialId}
          onChange={(e) => setMaterialId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
        >
          <option value="" disabled>Elegir...</option>
          {materiales.map((m) => (
            <option key={m.id} value={m.id}>{m.nombre}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700">Isleta</label>
        <select
          required
          value={isletaId}
          onChange={(e) => setIsletaId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
        >
          <option value="" disabled>Elegir...</option>
          {isletas.map((i) => (
            <option key={i.id} value={i.id}>{i.nombre}</option>
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
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
          />
        </div>
        <div className="w-32">
          <label className="block text-sm font-medium text-stone-700">Unidad</label>
          <select
            value={unidad}
            onChange={(e) => setUnidad(e.target.value)}
            className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
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
        <label className="block text-sm font-medium text-stone-700">Observaciones (opcional)</label>
        <textarea
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
        />
      </div>

      {mensaje && (
        <p
          className={`rounded-lg p-3 text-sm ${
            mensaje.tipo === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"
          }`}
        >
          {mensaje.texto}
        </p>
      )}

      <button
        type="submit"
        className="w-full rounded-lg bg-brand-700 px-4 py-3 text-base font-medium text-white hover:bg-brand-800"
      >
        Revisar movimiento
      </button>
    </form>
  );
}

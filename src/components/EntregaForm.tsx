"use client";

import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { createClient } from "@/lib/supabase/client";
import { getAlimentosActivos, getLotesActivos } from "@/lib/offline/catalogos";
import { guardarEntregaPendiente } from "@/lib/offline/db";
import { notificarCambio, sincronizarPendientes } from "@/lib/offline/sync";
import type { Alimento, Lote } from "@/lib/types";

function hoyISO() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

export default function EntregaForm({ userId, campoId }: { userId: string; campoId: string }) {
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [alimentos, setAlimentos] = useState<Alimento[]>([]);
  const [cargandoCatalogos, setCargandoCatalogos] = useState(true);

  const [fecha, setFecha] = useState(hoyISO());
  const [loteId, setLoteId] = useState("");
  const [alimentoId, setAlimentoId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [unidad, setUnidad] = useState("kg");
  const [observaciones, setObservaciones] = useState("");

  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "offline" | "error"; texto: string } | null>(null);
  const [revisando, setRevisando] = useState(false);

  useEffect(() => {
    Promise.all([getLotesActivos(campoId), getAlimentosActivos(campoId)])
      .then(([l, a]) => {
        setLotes(l);
        setAlimentos(a);
      })
      .catch(() => {
        setMensaje({ tipo: "error", texto: "No se pudieron cargar los lotes/alimentos. Conectate una vez a wifi y volvé a intentar." });
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
    if (!loteId || !alimentoId || !cantidad) return;
    setRevisando(true);
  }

  async function confirmarEnvio() {
    setMensaje(null);

    const entrega = {
      client_id: uuidv4(),
      fecha_entrega: fecha,
      lote_id: loteId,
      alimento_id: alimentoId,
      cantidad: Number(cantidad),
      unidad,
      observaciones: observaciones.trim() || null,
      cargado_por: userId,
    };

    setEnviando(true);

    const online = typeof navigator === "undefined" || navigator.onLine;

    if (online) {
      const supabase = createClient();
      const { error } = await supabase.from("entregas").insert(entrega);

      if (!error) {
        setEnviando(false);
        setMensaje({ tipo: "ok", texto: "Entrega registrada." });
        limpiarFormulario();
        notificarCambio();
        return;
      }
      // Si falló por conexión (no por un error de datos), la guardamos offline igual.
    }

    await guardarEntregaPendiente({ ...entrega, creada_en: new Date().toISOString(), intentos: 0 });
    notificarCambio();
    setEnviando(false);
    setMensaje({ tipo: "offline", texto: "Sin señal: la entrega quedó guardada en el celular y se va a subir sola cuando haya conexión." });
    limpiarFormulario();

    // Por si en realidad sí hay señal y sólo falló este pedido puntual.
    sincronizarPendientes().then(() => notificarCambio());
  }

  if (cargandoCatalogos) {
    return <p className="text-sm text-stone-500">Cargando...</p>;
  }

  if (lotes.length === 0 || alimentos.length === 0) {
    return (
      <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
        Todavía no hay lotes o tipos de alimento cargados. Pedile al administrador que los cree en
        Administración antes de registrar entregas.
      </p>
    );
  }

  if (revisando) {
    const nombreAlimento = alimentos.find((a) => a.id === alimentoId)?.nombre ?? "—";
    const nombreLote = lotes.find((l) => l.id === loteId)?.nombre ?? "—";

    return (
      <div className="space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-stone-200">
        <h2 className="text-sm font-medium text-stone-500">Revisá antes de enviar</h2>

        <dl className="divide-y divide-stone-100 rounded-lg border border-stone-200">
          {[
            ["Fecha de entrega", fecha],
            ["Tipo de alimento", nombreAlimento],
            ["Lote destino", nombreLote],
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
              mensaje.tipo === "ok"
                ? "bg-emerald-50 text-emerald-800"
                : mensaje.tipo === "offline"
                  ? "bg-amber-50 text-amber-800"
                  : "bg-red-50 text-red-700"
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
        <label className="block text-sm font-medium text-stone-700">Fecha de entrega</label>
        <input
          type="date"
          required
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700">Tipo de alimento</label>
        <select
          required
          value={alimentoId}
          onChange={(e) => setAlimentoId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
        >
          <option value="" disabled>Elegir...</option>
          {alimentos.map((a) => (
            <option key={a.id} value={a.id}>{a.nombre}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700">Lote destino</label>
        <select
          required
          value={loteId}
          onChange={(e) => setLoteId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
        >
          <option value="" disabled>Elegir...</option>
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
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
          />
        </div>
        <div className="w-28">
          <label className="block text-sm font-medium text-stone-700">Unidad</label>
          <select
            value={unidad}
            onChange={(e) => setUnidad(e.target.value)}
            className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
          >
            <option value="kg">kg</option>
            <option value="tn">tn</option>
            <option value="bolsas">bolsas</option>
            <option value="unidades">unidades</option>
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
            mensaje.tipo === "ok"
              ? "bg-emerald-50 text-emerald-800"
              : mensaje.tipo === "offline"
                ? "bg-amber-50 text-amber-800"
                : "bg-red-50 text-red-700"
          }`}
        >
          {mensaje.texto}
        </p>
      )}

      <button
        type="submit"
        className="w-full rounded-lg bg-brand-700 px-4 py-3 text-base font-medium text-white hover:bg-brand-800"
      >
        Revisar entrega
      </button>
    </form>
  );
}

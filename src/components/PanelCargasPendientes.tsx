"use client";

import { useState } from "react";
import {
  borrarEntregaPendiente,
  borrarMovimientoPendiente,
  type CargaPendiente,
} from "@/lib/offline/db";
import { explicarRechazo } from "@/lib/offline/errores";
import { notificarCambio, sincronizarPendientes } from "@/lib/offline/sync";

function fechaCorta(iso: string) {
  const [anio, mes, dia] = iso.slice(0, 10).split("-");
  return anio && mes && dia ? `${dia}/${mes}/${anio}` : iso;
}

/** Lista de lo guardado en el celular que todavía no subió, con el motivo si fue rechazado. */
export default function PanelCargasPendientes({
  cargas,
  online,
  onCerrar,
}: {
  cargas: CargaPendiente[];
  online: boolean;
  onCerrar: () => void;
}) {
  const [reintentando, setReintentando] = useState(false);
  const [aDescartar, setADescartar] = useState<string | null>(null);

  async function reintentar() {
    setReintentando(true);
    await sincronizarPendientes();
    notificarCambio();
    setReintentando(false);
  }

  async function descartar(carga: CargaPendiente) {
    if (carga.tipo === "entrega") await borrarEntregaPendiente(carga.client_id);
    else await borrarMovimientoPendiente(carga.client_id);
    setADescartar(null);
    notificarCambio();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center" onClick={onCerrar}>
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-stone-900">Cargas guardadas en el celular</h2>
          <button type="button" onClick={onCerrar} className="text-sm text-stone-500 hover:text-stone-800">
            Cerrar
          </button>
        </div>

        {cargas.length === 0 ? (
          <p className="mt-4 text-sm text-stone-600">No hay nada esperando para subir.</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-stone-500">
              {online ? "Estas cargas todavía no llegaron al servidor." : "Se suben solas cuando vuelva la señal."}
            </p>

            <ul className="mt-4 space-y-3">
              {cargas.map((c) => (
                <li
                  key={c.client_id}
                  className={`rounded-lg border p-3 text-sm ${c.ultimo_error ? "border-red-200 bg-red-50" : "border-stone-200"}`}
                >
                  <p className="font-medium text-stone-900">{c.resumen}</p>
                  <p className="text-stone-500">{fechaCorta(c.fecha)}</p>
                  {c.ultimo_error ? (
                    <p className="mt-1 text-red-700">{explicarRechazo(c.ultimo_error)}</p>
                  ) : (
                    <p className="mt-1 text-stone-500">Esperando para subir.</p>
                  )}

                  {c.ultimo_error &&
                    (aDescartar === c.client_id ? (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-red-700">Se borra del celular y no se puede recuperar.</span>
                        <button
                          type="button"
                          onClick={() => descartar(c)}
                          className="rounded-md bg-red-700 px-2.5 py-1 text-xs font-medium text-white"
                        >
                          Sí, descartar
                        </button>
                        <button type="button" onClick={() => setADescartar(null)} className="text-xs text-stone-600">
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setADescartar(c.client_id)}
                        className="mt-2 text-xs font-medium text-red-700 hover:underline"
                      >
                        Descartar
                      </button>
                    ))}
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={reintentar}
              disabled={!online || reintentando}
              className="mt-4 w-full rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60"
            >
              {reintentando ? "Reintentando..." : online ? "Reintentar ahora" : "Sin señal"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

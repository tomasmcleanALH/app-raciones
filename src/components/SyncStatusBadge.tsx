"use client";

import { useEffect, useState } from "react";
import { listarCargasPendientes, type CargaPendiente } from "@/lib/offline/db";
import { nombreGuardado } from "@/lib/offline/errores";
import { escucharPrecarga, faseDePrecarga } from "@/lib/offline/precarga";
import { escucharCambiosDeSync } from "@/lib/offline/sync";
import PanelCargasPendientes from "./PanelCargasPendientes";

/** Chip que muestra si hay entregas o movimientos de stock guardados en el celular esperando subir. */
export default function SyncStatusBadge() {
  const [cargas, setCargas] = useState<CargaPendiente[] | null>(null);
  const [online, setOnline] = useState(true);
  const [precarga, setPrecarga] = useState<ReturnType<typeof faseDePrecarga>>(null);
  const [panelAbierto, setPanelAbierto] = useState(false);

  useEffect(() => {
    setOnline(navigator.onLine);
    const actualizar = () => listarCargasPendientes(nombreGuardado).then(setCargas);
    actualizar();

    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const dejarDeEscuchar = escucharCambiosDeSync(actualizar);
    const actualizarPrecarga = () => setPrecarga(faseDePrecarga());
    actualizarPrecarga();
    const dejarDeEscucharPrecarga = escucharPrecarga(actualizarPrecarga);
    const intervalo = setInterval(actualizar, 5000);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      dejarDeEscuchar();
      dejarDeEscucharPrecarga();
      clearInterval(intervalo);
    };
  }, []);

  if (cargas === null) return null;

  const pendientes = cargas.length;
  const conProblema = cargas.filter((c) => c.ultimo_error).length;

  const panel = panelAbierto && (
    <PanelCargasPendientes cargas={cargas} online={online} onCerrar={() => setPanelAbierto(false)} />
  );

  if (conProblema > 0) {
    return (
      <>
        <button
          onClick={() => setPanelAbierto(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-800"
        >
          <span className="h-2 w-2 rounded-full bg-red-500" />
          {conProblema} carga{conProblema === 1 ? "" : "s"} con problema
        </button>
        {panel}
      </>
    );
  }

  if (!online) {
    return (
      <>
        {pendientes > 0 ? (
          <button
            onClick={() => setPanelAbierto(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800"
          >
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Sin señal · {pendientes} sin subir
          </button>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Sin señal
          </span>
        )}
        {panel}
      </>
    );
  }

  if (pendientes > 0) {
    return (
      <>
        <button
          onClick={() => setPanelAbierto(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-800"
        >
          <span className="h-2 w-2 animate-pulse rounded-full bg-sky-500" />
          Subiendo {pendientes} registro{pendientes === 1 ? "" : "s"}...
        </button>
        {panel}
      </>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
      <span className="h-2 w-2 rounded-full bg-emerald-500" />
      {precarga === "preparando"
        ? "Preparando para usar sin señal..."
        : precarga === "lista"
          ? "Listo para usar sin señal"
          : "Todo sincronizado"}
    </span>
  );
}

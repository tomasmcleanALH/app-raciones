"use client";

import { useEffect, useState } from "react";
import { contarPendientes } from "@/lib/offline/db";
import { escucharCambiosDeSync, sincronizarPendientes } from "@/lib/offline/sync";

/** Chip que muestra si hay entregas guardadas en el celular esperando subir. */
export default function SyncStatusBadge() {
  const [pendientes, setPendientes] = useState<number | null>(null);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const actualizar = () => contarPendientes().then(setPendientes);
    actualizar();

    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const dejarDeEscuchar = escucharCambiosDeSync(actualizar);
    const intervalo = setInterval(actualizar, 5000);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      dejarDeEscuchar();
      clearInterval(intervalo);
    };
  }, []);

  if (pendientes === null) return null;

  if (!online) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
        <span className="h-2 w-2 rounded-full bg-amber-500" />
        Sin señal{pendientes > 0 ? ` · ${pendientes} sin subir` : ""}
      </span>
    );
  }

  if (pendientes > 0) {
    return (
      <button
        onClick={() => sincronizarPendientes()}
        className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-800"
      >
        <span className="h-2 w-2 animate-pulse rounded-full bg-sky-500" />
        Subiendo {pendientes} entrega{pendientes === 1 ? "" : "s"}...
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
      <span className="h-2 w-2 rounded-full bg-emerald-500" />
      Todo sincronizado
    </span>
  );
}

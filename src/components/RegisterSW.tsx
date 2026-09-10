"use client";

import { useEffect } from "react";
import { iniciarSincronizacionAutomatica } from "@/lib/offline/sync";

/** Registra el service worker y arranca la sincronización automática al reconectar. */
export default function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Si falla el registro no rompemos la app; sólo se pierde el cache offline del cascarón.
      });
    }

    const detener = iniciarSincronizacionAutomatica();
    return detener;
  }, []);

  return null;
}

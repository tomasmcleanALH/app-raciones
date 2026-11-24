"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { iniciarSincronizacionAutomatica } from "@/lib/offline/sync";
import { precargarSiHaceFalta } from "@/lib/offline/precarga";

/** Registra el service worker, arranca la sincronización automática al reconectar y deja el celular listo para usarse sin señal. */
export default function RegisterSW() {
  const pathname = usePathname();

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Si falla el registro no rompemos la app; sólo se pierde el cache offline del cascarón.
      });
    }

    const detener = iniciarSincronizacionAutomatica();
    const alVolverLaSenal = () => void precargarSiHaceFalta();
    window.addEventListener("online", alVolverLaSenal);

    return () => {
      detener();
      window.removeEventListener("online", alVolverLaSenal);
    };
  }, []);

  // En cada pantalla nueva (también la que aparece después de iniciar sesión) se revisa si
  // hace falta precargar; si ya está al día no pide nada a la red.
  useEffect(() => {
    void precargarSiHaceFalta();
  }, [pathname]);

  return null;
}

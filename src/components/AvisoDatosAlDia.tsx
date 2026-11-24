"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// Una pantalla armada hace menos que esto con señal se considera al día.
const EDAD_MAXIMA_MS = 5 * 60_000;

// Las pantallas de cargar no muestran datos para leer: ahí el aviso sobra.
const SIN_AVISO = ["/entregar", "/stock/cargar"];

function cuando(generadoEn: number) {
  const fecha = new Date(generadoEn);
  const hora = fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  const esHoy = fecha.toDateString() === new Date().toDateString();
  return esHoy ? `las ${hora}` : `las ${hora} del ${fecha.toLocaleDateString("es-AR")}`;
}

/**
 * Avisa en las pantallas de lectura cuando lo que se ve puede estar desactualizado: sin señal,
 * o cuando la pantalla es una copia guardada en el celular (la armó el servidor hace rato).
 */
export default function AvisoDatosAlDia({ generadoEn }: { generadoEn: number }) {
  const pathname = usePathname();
  const [desactualizado, setDesactualizado] = useState(false);
  const [sinSenal, setSinSenal] = useState(false);

  useEffect(() => {
    const revisar = () => {
      setSinSenal(!navigator.onLine);
      setDesactualizado(Date.now() - generadoEn > EDAD_MAXIMA_MS);
    };
    revisar();
    window.addEventListener("online", revisar);
    window.addEventListener("offline", revisar);
    return () => {
      window.removeEventListener("online", revisar);
      window.removeEventListener("offline", revisar);
    };
  }, [generadoEn]);

  if (SIN_AVISO.some((ruta) => pathname.startsWith(ruta))) return null;
  if (!sinSenal && !desactualizado) return null;

  return (
    <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">
      {sinSenal ? "Sin señal: " : ""}estás viendo datos de {cuando(generadoEn)}. Pueden estar desactualizados
      {sinSenal ? "." : "; recargá la pantalla para verlos al día."}
    </p>
  );
}

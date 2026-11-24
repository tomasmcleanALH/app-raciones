"use client";

import { useEffect, useState } from "react";
import { verificarContextoPantalla, type ContextoPantalla } from "@/lib/offline/contexto";

/**
 * Envuelve las pantallas de cargar. Si la pantalla es una copia guardada de otro campo u
 * otro usuario, no muestra el formulario (para no cargar en el campo equivocado).
 */
export default function ContextoVigente({
  userId,
  campoId,
  generadoEn,
  children,
}: {
  userId: string;
  campoId: string;
  generadoEn: number;
  children: React.ReactNode;
}) {
  const [estado, setEstado] = useState<ContextoPantalla>("ok");

  useEffect(() => {
    let vigente = true;
    verificarContextoPantalla(userId, campoId, generadoEn).then((r) => {
      if (vigente) setEstado(r);
    });
    return () => {
      vigente = false;
    };
  }, [userId, campoId, generadoEn]);

  if (estado === "ok") return <>{children}</>;

  return (
    <div className="space-y-3 rounded-xl bg-amber-50 p-5 text-sm text-amber-900 ring-1 ring-amber-200">
      <p className="font-medium">Esta pantalla es una copia guardada de otro {estado === "campo" ? "campo" : "usuario"}.</p>
      <p>
        Para no cargar en el lugar equivocado, no se puede usar ahora. Abrila con señal para que
        se actualice.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-800"
      >
        Reintentar
      </button>
    </div>
  );
}

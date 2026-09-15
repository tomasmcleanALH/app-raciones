"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Campo } from "@/lib/types";

/** Elegir con cuál de los campos propios está trabajando ahora (aparece
 * apenas la persona pertenece a más de uno). */
export default function CampoSelector({ campos, campoActualId }: { campos: Campo[]; campoActualId: string }) {
  const router = useRouter();
  const [cambiando, setCambiando] = useState(false);

  async function cambiar(campoId: string) {
    if (campoId === campoActualId) return;
    setCambiando(true);
    await fetch("/api/campo-actual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campoId }),
    });
    router.refresh();
    setCambiando(false);
  }

  if (campos.length <= 1) {
    return campos[0] ? (
      <span className="rounded-lg bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">{campos[0].nombre}</span>
    ) : null;
  }

  return (
    <select
      value={campoActualId}
      onChange={(e) => cambiar(e.target.value)}
      disabled={cambiando}
      title="Campo con el que estás trabajando"
      className="rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs font-medium text-stone-700 disabled:opacity-60"
    >
      {campos.map((c) => (
        <option key={c.id} value={c.id}>{c.nombre}</option>
      ))}
    </select>
  );
}

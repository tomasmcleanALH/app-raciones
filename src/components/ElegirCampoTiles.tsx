"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Campo } from "@/lib/types";

export default function ElegirCampoTiles({ campos, veTodo }: { campos: Campo[]; veTodo: boolean }) {
  const router = useRouter();
  const [eligiendo, setEligiendo] = useState<string | null>(null);

  async function elegir(campoId: string) {
    setEligiendo(campoId);
    // Los roles de gestión van directo a elegir módulo; el
    // resto va a donde le corresponda (elegir-modulo lo resuelve).
    const destino = veTodo ? "/elegir-modulo" : "/";

    try {
      const r = await fetch("/api/campo-actual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campoId }),
      });
      if (!r.ok) throw new Error("No se pudo guardar el campo elegido.");
      router.push(destino);
      router.refresh();
    } catch {
      // Sin señal: no hay forma de pedirle al servidor que guarde la
      // elección, así que la guardamos igual desde acá (ver por qué es
      // seguro en /api/campo-actual) y navegamos "duro" en vez de con el
      // router de Next, para que el celular sirva la página ya guardada
      // de la última vez que hubo señal, en lugar de quedarse esperando
      // una respuesta que nunca va a llegar.
      document.cookie = `campo_actual=${campoId}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
      window.location.href = destino;
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
        {campos.map((c) => (
          <button
            key={c.id}
            onClick={() => elegir(c.id)}
            disabled={eligiendo !== null}
            className="rounded-2xl bg-white p-6 text-left shadow-sm ring-1 ring-stone-200/70 transition hover:shadow-md hover:ring-stone-300 disabled:cursor-wait disabled:opacity-60"
          >
            <p className="font-serif text-2xl font-bold text-stone-900">{c.nombre}</p>
            <p className="mt-1 text-sm text-stone-400">{eligiendo === c.id ? "Entrando..." : "Tocá para entrar"}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

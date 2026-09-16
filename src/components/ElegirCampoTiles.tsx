"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Campo } from "@/lib/types";

export default function ElegirCampoTiles({ campos, veTodo }: { campos: Campo[]; veTodo: boolean }) {
  const router = useRouter();
  const [eligiendo, setEligiendo] = useState<string | null>(null);

  async function elegir(campoId: string) {
    setEligiendo(campoId);
    await fetch("/api/campo-actual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campoId }),
    });
    // Los roles de gestión siguen la cadena Campo → Sección → Módulo; el
    // resto va directo a donde le corresponda (elegir-modulo lo resuelve).
    router.push(veTodo ? "/elegir-seccion" : "/");
    router.refresh();
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

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
    <div className={`grid flex-1 grid-cols-1 ${campos.length > 1 ? "sm:grid-cols-2" : ""}`}>
      {campos.map((c, i) => (
        <button
          key={c.id}
          onClick={() => elegir(c.id)}
          disabled={eligiendo !== null}
          className={`group flex min-h-[45vh] flex-col items-center justify-center gap-3 border border-white/5 px-6 text-center transition hover:brightness-125 disabled:cursor-wait disabled:opacity-70 ${
            i % 2 === 0 ? "bg-brand-900" : "bg-stone-950"
          }`}
        >
          <span className="text-2xl font-bold text-white sm:text-3xl">{c.nombre}</span>
          <span className="text-lg text-white/50 opacity-0 transition group-hover:opacity-100">
            {eligiendo === c.id ? "Entrando..." : "→"}
          </span>
        </button>
      ))}
    </div>
  );
}

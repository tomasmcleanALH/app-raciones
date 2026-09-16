"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Modulo } from "@/lib/types";

const ETIQUETA: Record<Modulo, string> = { alimentos: "Alimentos", materiales: "Materiales" };

export default function ElegirModuloTiles({
  modulos,
  campoNombre,
  veTodo,
}: {
  modulos: Modulo[];
  campoNombre: string;
  /** Los roles de gestión van al Stock de cada módulo; el que sólo carga
   * (entregas o movimientos) va directo a su formulario. */
  veTodo: boolean;
}) {
  const router = useRouter();
  const [eligiendo, setEligiendo] = useState<Modulo | null>(null);

  const destino: Record<Modulo, string> = {
    alimentos: veTodo ? "/alimentos" : "/entregar",
    materiales: veTodo ? "/stock" : "/stock/cargar",
  };

  async function elegir(m: Modulo) {
    setEligiendo(m);
    await fetch("/api/modulo-actual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modulo: m }),
    });
    router.push(destino[m]);
    router.refresh();
  }

  return (
    <div className="flex flex-1 flex-col">
      <p className="px-4 pt-6 text-center text-sm text-white/50">{campoNombre}</p>
      <div className={`grid flex-1 grid-cols-1 ${modulos.length > 1 ? "sm:grid-cols-2" : ""}`}>
        {modulos.map((m, i) => (
          <button
            key={m}
            onClick={() => elegir(m)}
            disabled={eligiendo !== null}
            className={`group flex min-h-[45vh] flex-col items-center justify-center gap-3 border border-white/5 px-6 text-center transition hover:brightness-125 disabled:cursor-wait disabled:opacity-70 ${
              i % 2 === 0 ? "bg-brand-900" : "bg-stone-950"
            }`}
          >
            <span className="text-2xl font-bold text-white sm:text-3xl">{ETIQUETA[m]}</span>
            <span className="text-lg text-white/50 opacity-0 transition group-hover:opacity-100">
              {eligiendo === m ? "Entrando..." : "→"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

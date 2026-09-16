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
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-10">
      <p className="text-sm text-stone-400">{campoNombre}</p>
      <div className="grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
        {modulos.map((m) => (
          <button
            key={m}
            onClick={() => elegir(m)}
            disabled={eligiendo !== null}
            className="rounded-2xl bg-white p-6 text-left shadow-sm ring-1 ring-stone-200/70 transition hover:shadow-md hover:ring-stone-300 disabled:cursor-wait disabled:opacity-60"
          >
            <p className="font-serif text-2xl font-bold text-stone-900">{ETIQUETA[m]}</p>
            <p className="mt-1 text-sm text-stone-400">{eligiendo === m ? "Entrando..." : "Tocá para entrar"}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

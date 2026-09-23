"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Modulo } from "@/lib/types";

const ETIQUETA: Record<Modulo, string> = { alimentos: "Alimentos", materiales: "Materiales" };

export default function ElegirModuloTiles({
  modulos,
  campoNombre,
  veTodo,
  mostrarVolver,
}: {
  modulos: Modulo[];
  campoNombre: string;
  /** Los roles de gestión van al Stock de cada módulo; el que sólo carga
   * (entregas o movimientos) va directo a su formulario. */
  veTodo: boolean;
  /** Sólo tiene sentido volver a elegir campo si pertenece a más de uno. */
  mostrarVolver: boolean;
}) {
  const router = useRouter();
  const [eligiendo, setEligiendo] = useState<Modulo | null>(null);

  const destino: Record<Modulo, string> = {
    alimentos: veTodo ? "/alimentos" : "/entregar",
    materiales: veTodo ? "/stock" : "/stock/cargar",
  };

  async function elegir(m: Modulo) {
    setEligiendo(m);

    try {
      const r = await fetch("/api/modulo-actual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modulo: m }),
      });
      if (!r.ok) throw new Error("No se pudo guardar el módulo elegido.");
      router.push(destino[m]);
      router.refresh();
    } catch {
      // Sin señal: no hay forma de pedirle al servidor que guarde la
      // elección, así que la guardamos igual desde acá (ver por qué es
      // seguro en /api/modulo-actual) y navegamos "duro" en vez de con el
      // router de Next, para que el celular sirva la página ya guardada
      // de la última vez que hubo señal, en lugar de quedarse esperando
      // una respuesta que nunca va a llegar.
      document.cookie = `modulo_actual=${m}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
      window.location.href = destino[m];
    }
  }

  return (
    <div className="flex flex-1 justify-center px-4 py-10">
      <div className="w-full max-w-2xl">
        {mostrarVolver && (
          <Link href="/elegir-campo" className="text-sm font-medium text-brand-700 hover:underline">
            ← Todos los establecimientos
          </Link>
        )}
        <h1 className="mb-6 mt-2 font-serif text-2xl font-bold text-stone-900">{campoNombre}</h1>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
    </div>
  );
}

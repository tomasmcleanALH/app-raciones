"use client";

import Link from "next/link";
import type { Modulo } from "@/lib/types";

const DESTINO: Record<Modulo, string> = { alimentos: "/alimentos", materiales: "/stock" };
const ETIQUETA: Record<Modulo, string> = { alimentos: "Alimentos", materiales: "Materiales" };

export default function ElegirModuloTiles({ modulos, campoNombre }: { modulos: Modulo[]; campoNombre: string }) {
  return (
    <div className="flex flex-1 flex-col">
      <p className="px-4 pt-6 text-center text-sm text-white/50">{campoNombre}</p>
      <div className="grid flex-1 grid-cols-1 sm:grid-cols-2">
        {modulos.map((m, i) => (
          <Link
            key={m}
            href={DESTINO[m]}
            className={`group flex min-h-[45vh] flex-col items-center justify-center gap-3 border border-white/5 px-6 text-center transition hover:brightness-125 ${
              i % 2 === 0 ? "bg-brand-900" : "bg-stone-950"
            }`}
          >
            <span className="text-2xl font-bold text-white sm:text-3xl">{ETIQUETA[m]}</span>
            <span className="text-lg text-white/50 opacity-0 transition group-hover:opacity-100">→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

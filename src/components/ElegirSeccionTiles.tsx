import Link from "next/link";

const SECCIONES = [{ id: "operaciones", nombre: "Operaciones" }];

/** Elección de qué ver dentro del campo. Hoy sólo existe "Operaciones",
 * pero el día de mañana puede haber más cosas acá al mismo nivel. */
export default function ElegirSeccionTiles({ campoNombre }: { campoNombre: string }) {
  return (
    <div className="flex flex-1 flex-col">
      <p className="px-4 pt-6 text-center text-sm text-white/50">{campoNombre}</p>
      <div className={`grid flex-1 grid-cols-1 ${SECCIONES.length > 1 ? "sm:grid-cols-2" : ""}`}>
        {SECCIONES.map((s, i) => (
          <Link
            key={s.id}
            href="/elegir-modulo"
            className={`group flex min-h-[45vh] flex-col items-center justify-center gap-3 border border-white/5 px-6 text-center transition hover:brightness-125 ${
              i % 2 === 0 ? "bg-brand-900" : "bg-stone-950"
            }`}
          >
            <span className="text-2xl font-bold text-white sm:text-3xl">{s.nombre}</span>
            <span className="text-lg text-white/50 opacity-0 transition group-hover:opacity-100">→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

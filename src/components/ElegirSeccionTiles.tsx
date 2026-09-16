import Link from "next/link";

const SECCIONES = [{ id: "operaciones", nombre: "Operaciones" }];

/** Elección de qué ver dentro del campo. Hoy sólo existe "Operaciones",
 * pero el día de mañana puede haber más cosas acá al mismo nivel. */
export default function ElegirSeccionTiles({
  campoNombre,
  mostrarVolver,
}: {
  campoNombre: string;
  /** Sólo tiene sentido volver a elegir campo si pertenece a más de uno. */
  mostrarVolver: boolean;
}) {
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
          {SECCIONES.map((s) => (
            <Link
              key={s.id}
              href="/elegir-modulo"
              className="rounded-2xl bg-white p-6 text-left shadow-sm ring-1 ring-stone-200/70 transition hover:shadow-md hover:ring-stone-300"
            >
              <p className="font-serif text-2xl font-bold text-stone-900">{s.nombre}</p>
              <p className="mt-1 text-sm text-stone-400">Tocá para entrar</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

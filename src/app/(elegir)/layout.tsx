import BotonSalir from "@/components/BotonSalir";
import { requireProfile } from "@/lib/auth";

/** Layout minimalista (sin el menú de módulos) para las pantallas de
 * elegir Campo / elegir Módulo: son un paso previo a entrar a un módulo. */
export default async function ElegirLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile();

  return (
    <div className="flex min-h-screen flex-col bg-stone-100">
      <header className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
        <span className="flex items-center gap-2 font-bold text-stone-900">
          <img src="/logo-las-helenas.jpg" alt="" className="h-7 w-7 rounded-md object-cover" />
          Operaciones
        </span>
        <div className="flex items-center gap-3 text-sm text-stone-500">
          <span>{profile.nombre}</span>
          <BotonSalir className="text-stone-400 hover:text-stone-700" />
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}

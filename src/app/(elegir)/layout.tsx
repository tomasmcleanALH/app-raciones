import BotonSalir from "@/components/BotonSalir";
import { requireProfile } from "@/lib/auth";

/** Layout minimalista (sin el menú de módulos) para las pantallas de
 * elegir Campo / elegir Módulo: son un paso previo a entrar a un módulo. */
export default async function ElegirLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile();

  return (
    <div className="flex min-h-screen flex-col bg-stone-950">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <span className="flex items-center gap-2 font-bold text-white">
          <img src="/logo-las-helenas.jpg" alt="" className="h-7 w-7 rounded-md object-cover" />
          Operaciones
        </span>
        <div className="flex items-center gap-3 text-sm text-white/60">
          <span>{profile.nombre}</span>
          <BotonSalir className="text-white/50 hover:text-white" />
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}

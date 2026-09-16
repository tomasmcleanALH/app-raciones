import Nav from "@/components/Nav";
import { requireProfile } from "@/lib/auth";
import { obtenerCampoActual } from "@/lib/campo";
import { obtenerModuloActual, obtenerModulosEfectivos } from "@/lib/modulos";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId, profile } = await requireProfile();
  const { campo, campos } = await obtenerCampoActual(userId, profile.rol);
  const modulos = await obtenerModulosEfectivos(userId, profile.rol, campo?.id ?? null);
  const moduloActual = await obtenerModuloActual(modulos);

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <Nav
        nombre={profile.nombre}
        rol={profile.rol}
        campos={campos}
        modulos={modulos}
        moduloActual={moduloActual}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}

import Nav from "@/components/Nav";
import { requireProfile } from "@/lib/auth";
import { obtenerCampoActual } from "@/lib/campo";
import { obtenerModulosUsuario } from "@/lib/modulos";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId, profile } = await requireProfile();
  const { campo, campos } = await obtenerCampoActual(userId, profile.rol);
  const modulos = await obtenerModulosUsuario(userId, profile.rol);

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <Nav nombre={profile.nombre} rol={profile.rol} campo={campo} campos={campos} modulos={modulos} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}

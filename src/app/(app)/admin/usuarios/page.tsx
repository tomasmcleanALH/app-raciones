import UsuariosAdmin from "@/components/UsuariosAdmin";
import { requireGestionUsuarios } from "@/lib/auth";
import { obtenerCampoActual } from "@/lib/campo";
import { obtenerModulosEfectivos } from "@/lib/modulos";

export default async function UsuariosAdminPage() {
  const { userId, profile } = await requireGestionUsuarios();
  const esDueno = profile.rol === "dueno";

  if (!esDueno) {
    const { campo } = await obtenerCampoActual(userId, profile.rol);
    if (!campo) {
      return (
        <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
          Todavía no te asignaron a ningún campo. Hablá con el Dueño.
        </p>
      );
    }

    // Gestionar usuarios es parte del módulo Alimentos: un administrador de
    // sólo Materiales no ve esta sección.
    const modulos = await obtenerModulosEfectivos(userId, profile.rol, campo.id);
    if (!modulos.includes("alimentos")) {
      return (
        <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
          No tenés acceso a esta sección.
        </p>
      );
    }

    return <UsuariosAdmin miPropioId={userId} esDueno={false} miCampoNombre={campo.nombre} />;
  }

  return <UsuariosAdmin miPropioId={userId} esDueno />;
}

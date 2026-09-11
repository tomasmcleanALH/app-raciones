import UsuariosAdmin from "@/components/UsuariosAdmin";
import { requireGestionUsuarios } from "@/lib/auth";
import { obtenerCampoActual } from "@/lib/campo";

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
    return <UsuariosAdmin miPropioId={userId} esDueno={false} miCampoNombre={campo.nombre} />;
  }

  return <UsuariosAdmin miPropioId={userId} esDueno />;
}

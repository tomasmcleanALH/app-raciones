import { redirect } from "next/navigation";
import CatalogoAdmin from "@/components/CatalogoAdmin";
import { requireEncargadoOGerente } from "@/lib/auth";
import { obtenerCampoActual } from "@/lib/campo";
import { obtenerModulosUsuario } from "@/lib/modulos";

export default async function IsletasAdminPage() {
  const { userId, profile } = await requireEncargadoOGerente();
  const modulos = await obtenerModulosUsuario(userId, profile.rol);
  if (!modulos.includes("materiales")) redirect("/");

  const { campo } = await obtenerCampoActual(userId, profile.rol);

  if (!campo) {
    return (
      <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
        {profile.rol === "dueno"
          ? "Todavía no creaste ningún campo. Andá a Campos para crear el primero."
          : "Todavía no te asignaron a ningún campo. Hablá con el administrador."}
      </p>
    );
  }

  return (
    <CatalogoAdmin
      tabla="isletas"
      titulo="Isletas"
      campoId={campo.id}
      soloLectura={profile.rol !== "encargado" && profile.rol !== "dueno"}
    />
  );
}

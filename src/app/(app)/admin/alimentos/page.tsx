import { redirect } from "next/navigation";
import CatalogoAdmin from "@/components/CatalogoAdmin";
import { requireEncargadoOGerente } from "@/lib/auth";
import { obtenerCampoActual } from "@/lib/campo";
import { obtenerModulosEfectivos } from "@/lib/modulos";

export default async function AlimentosAdminPage() {
  const { userId, profile } = await requireEncargadoOGerente();
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

  const modulos = await obtenerModulosEfectivos(userId, profile.rol, campo.id);
  if (!modulos.includes("alimentos")) redirect("/");

  return (
    <CatalogoAdmin
      tabla="alimentos"
      titulo="Tipos de alimento"
      campoId={campo.id}
      soloLectura={profile.rol !== "encargado" && profile.rol !== "dueno"}
    />
  );
}

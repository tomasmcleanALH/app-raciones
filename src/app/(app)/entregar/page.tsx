import { redirect } from "next/navigation";
import EntregaForm from "@/components/EntregaForm";
import UltimasEntregas from "@/components/UltimasEntregas";
import { requireProfile } from "@/lib/auth";
import { obtenerCampoActual } from "@/lib/campo";
import { obtenerModulosUsuario } from "@/lib/modulos";

export default async function EntregarPage() {
  const { userId, profile } = await requireProfile();
  const modulos = await obtenerModulosUsuario(userId, profile.rol);
  if (!modulos.includes("alimentos")) redirect("/");

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
    <div className="mx-auto max-w-md">
      <h1 className="mb-4 text-xl font-bold text-stone-900">Cargar entrega</h1>
      <EntregaForm userId={userId} campoId={campo.id} />
      <UltimasEntregas userId={userId} campoId={campo.id} />
    </div>
  );
}

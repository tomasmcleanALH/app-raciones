import { redirect } from "next/navigation";
import HistorialAlimentos from "@/components/HistorialAlimentos";
import { requireProfile } from "@/lib/auth";
import { obtenerCampoActual } from "@/lib/campo";
import { obtenerModulosEfectivos } from "@/lib/modulos";

export default async function HistorialAlimentosPage() {
  const { userId, profile } = await requireProfile();
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

  // Igual que la Grilla de Materiales: sólo lo ven los roles de gestión, no
  // el que sólo carga entregas (para eso está "Cargar entrega").
  if (!["encargado", "gerente", "dueno"].includes(profile.rol)) redirect("/entregar");

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-stone-900">Historial de movimientos</h1>
      <HistorialAlimentos campoId={campo.id} puedeEditar={profile.rol === "encargado" || profile.rol === "dueno"} />
    </div>
  );
}

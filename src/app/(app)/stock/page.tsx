import { redirect } from "next/navigation";
import MovimientoForm from "@/components/MovimientoForm";
import StockDisponibleTable from "@/components/StockDisponibleTable";
import UltimasMovimientos from "@/components/UltimasMovimientos";
import { requireProfile } from "@/lib/auth";
import { obtenerCampoActual } from "@/lib/campo";
import { obtenerModulosEfectivos } from "@/lib/modulos";

export default async function StockPage() {
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
  if (!modulos.includes("materiales")) redirect("/");

  if (profile.rol === "encargado" || profile.rol === "gerente" || profile.rol === "dueno") {
    return (
      <div>
        <h1 className="mb-4 text-xl font-bold text-stone-900">Stock de materiales</h1>
        <StockDisponibleTable campoId={campo.id} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-4 text-xl font-bold text-stone-900">Cargar movimiento de stock</h1>
      <MovimientoForm userId={userId} campoId={campo.id} />
      <UltimasMovimientos userId={userId} campoId={campo.id} />
    </div>
  );
}

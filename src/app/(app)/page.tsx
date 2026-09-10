import EntregaForm from "@/components/EntregaForm";
import GrillaTable from "@/components/GrillaTable";
import UltimasEntregas from "@/components/UltimasEntregas";
import { requireProfile } from "@/lib/auth";

export default async function HomePage() {
  const { userId, profile } = await requireProfile();

  if (profile.rol === "encargado") {
    return (
      <div>
        <h1 className="mb-4 text-xl font-bold text-stone-900">Todas las entregas</h1>
        <GrillaTable />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-4 text-xl font-bold text-stone-900">Cargar entrega</h1>
      <EntregaForm userId={userId} />
      <UltimasEntregas userId={userId} />
    </div>
  );
}

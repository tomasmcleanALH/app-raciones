import EntregaForm from "@/components/EntregaForm";
import UltimasEntregas from "@/components/UltimasEntregas";
import { requireProfile } from "@/lib/auth";

export default async function EntregarPage() {
  const { userId } = await requireProfile();

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-4 text-xl font-bold text-stone-900">Cargar entrega</h1>
      <EntregaForm userId={userId} />
      <UltimasEntregas userId={userId} />
    </div>
  );
}

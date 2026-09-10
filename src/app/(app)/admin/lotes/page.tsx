import CatalogoAdmin from "@/components/CatalogoAdmin";
import { requireEncargadoOGerente } from "@/lib/auth";

export default async function LotesAdminPage() {
  const { profile } = await requireEncargadoOGerente();
  return <CatalogoAdmin tabla="lotes" titulo="Lotes" soloLectura={profile.rol !== "encargado"} />;
}

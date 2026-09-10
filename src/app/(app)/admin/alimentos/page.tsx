import CatalogoAdmin from "@/components/CatalogoAdmin";
import { requireEncargadoOGerente } from "@/lib/auth";

export default async function AlimentosAdminPage() {
  const { profile } = await requireEncargadoOGerente();
  return <CatalogoAdmin tabla="alimentos" titulo="Tipos de alimento" soloLectura={profile.rol !== "encargado"} />;
}

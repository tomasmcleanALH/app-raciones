import CatalogoAdmin from "@/components/CatalogoAdmin";
import { requireEncargado } from "@/lib/auth";

export default async function AlimentosAdminPage() {
  await requireEncargado();
  return <CatalogoAdmin tabla="alimentos" titulo="Tipos de alimento" />;
}

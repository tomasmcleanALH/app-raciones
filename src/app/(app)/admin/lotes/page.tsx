import CatalogoAdmin from "@/components/CatalogoAdmin";
import { requireEncargado } from "@/lib/auth";

export default async function LotesAdminPage() {
  await requireEncargado();
  return <CatalogoAdmin tabla="lotes" titulo="Lotes" />;
}

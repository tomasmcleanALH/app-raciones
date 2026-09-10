import UsuariosAdmin from "@/components/UsuariosAdmin";
import { requireEncargado } from "@/lib/auth";

export default async function UsuariosAdminPage() {
  const { userId } = await requireEncargado();
  return <UsuariosAdmin miPropioId={userId} />;
}

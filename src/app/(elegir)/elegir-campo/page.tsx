import { redirect } from "next/navigation";
import ElegirCampoTiles from "@/components/ElegirCampoTiles";
import { requireProfile } from "@/lib/auth";
import { obtenerCampoActual, requiereElegirCampo } from "@/lib/campo";

export default async function ElegirCampoPage() {
  const { userId, profile } = await requireProfile();
  const veTodo = ["encargado", "gerente", "dueno"].includes(profile.rol);
  const { campos } = await obtenerCampoActual(userId, profile.rol);

  if (campos.length === 0) redirect("/");
  // Los roles de gestión siempre pasan por acá, aunque haya un solo campo.
  if (!veTodo && !(await requiereElegirCampo(campos))) redirect("/");

  return <ElegirCampoTiles campos={campos} veTodo={veTodo} />;
}

import { redirect } from "next/navigation";
import ElegirSeccionTiles from "@/components/ElegirSeccionTiles";
import { requireProfile } from "@/lib/auth";
import { obtenerCampoActual } from "@/lib/campo";

export default async function ElegirSeccionPage() {
  const { userId, profile } = await requireProfile();
  const veTodo = ["encargado", "gerente", "dueno"].includes(profile.rol);
  if (!veTodo) redirect("/");

  const { campo } = await obtenerCampoActual(userId, profile.rol);
  if (!campo) redirect("/elegir-campo");

  return <ElegirSeccionTiles campoNombre={campo.nombre} />;
}

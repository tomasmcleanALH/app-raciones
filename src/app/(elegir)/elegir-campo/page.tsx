import { redirect } from "next/navigation";
import ElegirCampoTiles from "@/components/ElegirCampoTiles";
import { requireProfile } from "@/lib/auth";
import { obtenerCampoActual, requiereElegirCampo } from "@/lib/campo";

export default async function ElegirCampoPage() {
  const { userId, profile } = await requireProfile();
  const { campos } = await obtenerCampoActual(userId, profile.rol);

  if (!(await requiereElegirCampo(campos))) redirect("/");

  return <ElegirCampoTiles campos={campos} />;
}

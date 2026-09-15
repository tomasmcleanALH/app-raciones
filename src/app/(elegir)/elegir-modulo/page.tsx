import { redirect } from "next/navigation";
import ElegirModuloTiles from "@/components/ElegirModuloTiles";
import { requireProfile } from "@/lib/auth";
import { obtenerCampoActual, requiereElegirCampo } from "@/lib/campo";
import { obtenerModulosEfectivos } from "@/lib/modulos";

export default async function ElegirModuloPage() {
  const { userId, profile } = await requireProfile();
  const { campo, campos } = await obtenerCampoActual(userId, profile.rol);

  if (await requiereElegirCampo(campos)) redirect("/elegir-campo");
  if (!campo) redirect("/");

  const modulos = await obtenerModulosEfectivos(userId, profile.rol, campo.id);
  if (modulos.length <= 1) redirect("/");

  return <ElegirModuloTiles modulos={modulos} campoNombre={campo.nombre} />;
}

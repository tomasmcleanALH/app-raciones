import { redirect } from "next/navigation";
import ElegirModuloTiles from "@/components/ElegirModuloTiles";
import { requireProfile } from "@/lib/auth";
import { obtenerCampoActual, requiereElegirCampo } from "@/lib/campo";
import { obtenerModulosEfectivos } from "@/lib/modulos";

export default async function ElegirModuloPage() {
  const { userId, profile } = await requireProfile();
  const veTodo = ["encargado", "gerente", "dueno"].includes(profile.rol);
  const { campo, campos } = await obtenerCampoActual(userId, profile.rol);

  // Los roles de gestión siempre pasan por acá, aunque haya una sola opción;
  // el resto sólo cuando hace falta elegir campo o tiene más de un módulo.
  if (!veTodo && (await requiereElegirCampo(campos))) redirect("/elegir-campo");
  if (!campo) redirect("/");

  const modulos = await obtenerModulosEfectivos(userId, profile.rol, campo.id);
  if (modulos.length === 0) redirect("/");
  if (!veTodo && modulos.length <= 1) redirect("/");

  return <ElegirModuloTiles modulos={modulos} campoNombre={campo.nombre} veTodo={veTodo} />;
}

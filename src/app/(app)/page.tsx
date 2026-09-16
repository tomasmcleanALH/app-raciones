import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { obtenerCampoActual, requiereElegirCampo } from "@/lib/campo";
import { obtenerModulosEfectivos } from "@/lib/modulos";

/**
 * "/" no es una pantalla en sí: resuelve Ingreso → Campo → Módulo y
 * redirige a donde corresponda (o muestra la pantalla de elegir cuando
 * hay más de una opción en algún paso).
 */
export default async function HomePage() {
  const { userId, profile } = await requireProfile();
  const { campo, campos } = await obtenerCampoActual(userId, profile.rol);

  if (await requiereElegirCampo(campos)) redirect("/elegir-campo");

  if (!campo) {
    return (
      <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
        {profile.rol === "dueno"
          ? "Todavía no creaste ningún campo. Andá a Campos para crear el primero."
          : "Todavía no te asignaron a ningún campo. Hablá con el administrador."}
      </p>
    );
  }

  const modulos = await obtenerModulosEfectivos(userId, profile.rol, campo.id);

  if (modulos.length === 0) {
    return (
      <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
        Todavía no tenés acceso a ningún módulo en este campo. Hablá con el Dueño.
      </p>
    );
  }

  if (modulos.length > 1) redirect("/elegir-modulo");

  // Los roles de gestión caen en la pantalla de Stock de su módulo; el que
  // sólo carga (entregas o movimientos) va directo a su formulario.
  const veTodo = ["encargado", "gerente", "dueno"].includes(profile.rol);
  if (modulos[0] === "alimentos") redirect(veTodo ? "/alimentos" : "/entregar");
  redirect(veTodo ? "/stock" : "/stock/cargar");
}

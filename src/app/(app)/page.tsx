import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { obtenerCampoActual, requiereElegirCampo } from "@/lib/campo";
import { obtenerModulosEfectivos } from "@/lib/modulos";

/**
 * "/" no es una pantalla en sí: resuelve Ingreso → Campo → Sección →
 * Módulo. Los roles de gestión siempre pasan por esa cadena de pantallas
 * de elección, aunque haya una sola opción en cada paso; el que sólo
 * carga (entregas o movimientos) va directo a su formulario, sin pantallas
 * de por medio.
 */
export default async function HomePage() {
  const { userId, profile } = await requireProfile();
  const veTodo = ["encargado", "gerente", "dueno"].includes(profile.rol);
  const { campo, campos } = await obtenerCampoActual(userId, profile.rol);

  if (campos.length === 0) {
    return (
      <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
        {profile.rol === "dueno"
          ? "Todavía no creaste ningún campo. Andá a Campos para crear el primero."
          : "Todavía no te asignaron a ningún campo. Hablá con el administrador."}
      </p>
    );
  }

  if (veTodo) redirect("/elegir-campo");

  if (await requiereElegirCampo(campos)) redirect("/elegir-campo");
  if (!campo) redirect("/elegir-campo");

  const modulos = await obtenerModulosEfectivos(userId, profile.rol, campo.id);

  if (modulos.length === 0) {
    return (
      <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
        Todavía no tenés acceso a ningún módulo en este campo. Hablá con el Dueño.
      </p>
    );
  }

  if (modulos.length > 1) redirect("/elegir-modulo");
  if (modulos[0] === "alimentos") redirect("/entregar");
  redirect("/stock/cargar");
}

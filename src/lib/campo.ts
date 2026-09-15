import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { Campo, Rol } from "@/lib/types";

export const COOKIE_CAMPO_ACTUAL = "campo_actual";

/**
 * Campo con el que trabaja esta sesión ahora mismo, de la lista de campos
 * a los que pertenece este usuario (el Dueño pertenece a todos). Cualquier
 * usuario puede pertenecer a más de un campo; si es así, se usa el que
 * eligió con el selector (cookie), o el primero activo si todavía no eligió.
 *
 * Devuelve también la lista completa de campos a los que pertenece (útil
 * para el selector, que sólo se muestra cuando hay más de uno).
 */
export async function obtenerCampoActual(
  userId: string,
  rol: Rol,
): Promise<{ campo: Campo | null; campos: Campo[] }> {
  const supabase = await createClient();

  let lista: Campo[];
  if (rol === "dueno") {
    const { data } = await supabase.from("campos").select("*").order("nombre");
    lista = (data ?? []) as Campo[];
  } else {
    const { data } = await supabase
      .from("usuarios_campos")
      .select("campos(*)")
      .eq("usuario_id", userId);
    lista = ((data ?? []) as any[])
      .map((fila) => fila.campos as Campo)
      .filter(Boolean)
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  if (lista.length === 0) return { campo: null, campos: [] };
  if (lista.length === 1) return { campo: lista[0], campos: lista };

  const cookieStore = await cookies();
  const elegidoId = cookieStore.get(COOKIE_CAMPO_ACTUAL)?.value;
  const elegido = lista.find((c) => c.id === elegidoId && c.activo);
  return { campo: elegido ?? lista.find((c) => c.activo) ?? lista[0], campos: lista };
}

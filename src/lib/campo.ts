import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { Campo, Rol } from "@/lib/types";

export const COOKIE_CAMPO_ACTUAL = "campo_actual";

/**
 * Campo con el que trabaja esta sesión ahora mismo:
 * - Si no es dueño: el único campo al que pertenece (o null si todavía
 *   no se lo asignaron a ninguno).
 * - Si es dueño: el que eligió con el selector (cookie), o el primero
 *   que haya, o null si todavía no se creó ningún campo.
 *
 * Devuelve también la lista completa de campos (sólo tiene más de uno
 * cuando es dueño; útil para el selector).
 */
export async function obtenerCampoActual(
  userId: string,
  rol: Rol,
): Promise<{ campo: Campo | null; campos: Campo[] }> {
  const supabase = await createClient();

  if (rol !== "dueno") {
    const { data } = await supabase
      .from("usuarios_campos")
      .select("campos(*)")
      .eq("usuario_id", userId)
      .limit(1)
      .maybeSingle();
    const campo = (data?.campos as unknown as Campo) ?? null;
    return { campo, campos: campo ? [campo] : [] };
  }

  const { data: campos } = await supabase.from("campos").select("*").order("nombre");
  const lista = (campos ?? []) as Campo[];
  if (lista.length === 0) return { campo: null, campos: [] };

  const cookieStore = await cookies();
  const elegidoId = cookieStore.get(COOKIE_CAMPO_ACTUAL)?.value;
  const elegido = lista.find((c) => c.id === elegidoId && c.activo);
  return { campo: elegido ?? lista.find((c) => c.activo) ?? lista[0], campos: lista };
}

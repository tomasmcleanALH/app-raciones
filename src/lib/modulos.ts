import { createClient } from "@/lib/supabase/server";
import type { Modulo, Rol } from "@/lib/types";

/**
 * A qué módulo(s) tiene acceso este usuario: "alimentos", "materiales",
 * o ambos. El Dueño siempre tiene acceso a todos (no necesita filas en
 * usuarios_modulos). Para el resto, depende de lo que le hayan habilitado.
 */
export async function obtenerModulosUsuario(userId: string, rol: Rol): Promise<Modulo[]> {
  if (rol === "dueno") return ["alimentos", "materiales"];

  const supabase = await createClient();
  const { data } = await supabase.from("usuarios_modulos").select("modulo").eq("usuario_id", userId);
  return ((data ?? []) as { modulo: Modulo }[]).map((d) => d.modulo);
}

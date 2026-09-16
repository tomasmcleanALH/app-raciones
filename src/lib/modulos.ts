import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { Modulo, Rol } from "@/lib/types";

export const COOKIE_MODULO_ACTUAL = "modulo_actual";

/**
 * A qué módulo(s) tiene acceso este usuario (sin importar el campo):
 * "alimentos", "materiales", o ambos. El Dueño siempre tiene acceso a
 * todos (no necesita filas en usuarios_modulos). Para el resto, depende
 * de lo que le hayan habilitado.
 */
export async function obtenerModulosUsuario(userId: string, rol: Rol): Promise<Modulo[]> {
  if (rol === "dueno") return ["alimentos", "materiales"];

  const supabase = await createClient();
  const { data } = await supabase.from("usuarios_modulos").select("modulo").eq("usuario_id", userId);
  return ((data ?? []) as { modulo: Modulo }[]).map((d) => d.modulo);
}

/** Qué módulo(s) tiene habilitados un campo (propiedad del campo, no del usuario). */
export async function obtenerModulosCampo(campoId: string): Promise<Modulo[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("campo_modulos").select("modulo").eq("campo_id", campoId);
  return ((data ?? []) as { modulo: Modulo }[]).map((d) => d.modulo);
}

/**
 * Los módulos que esta persona puede usar EN ESTE CAMPO puntual: la
 * intersección entre lo que tiene habilitado ella (usuarios_modulos, o
 * todo si es Dueño) y lo que tiene habilitado el campo (campo_modulos).
 * Así, por ejemplo, el Stock de materiales puede estar prendido para
 * "Las Isletas" y apagado para "San Jorge", sin importar el rol de
 * quien esté mirando.
 */
export async function obtenerModulosEfectivos(userId: string, rol: Rol, campoId: string | null): Promise<Modulo[]> {
  if (!campoId) return [];
  const [modulosUsuario, modulosCampo] = await Promise.all([
    obtenerModulosUsuario(userId, rol),
    obtenerModulosCampo(campoId),
  ]);
  return modulosUsuario.filter((m) => modulosCampo.includes(m));
}

/**
 * Qué módulo está "activo" en el Nav ahora mismo: el que eligió en la
 * pantalla de tiles (cookie), o directamente el único que tiene si no hay
 * ambigüedad. Sirve para que el Nav muestre sólo ese módulo y no todos los
 * que tiene habilitados.
 */
export async function obtenerModuloActual(modulosEfectivos: Modulo[]): Promise<Modulo | null> {
  if (modulosEfectivos.length === 0) return null;
  if (modulosEfectivos.length === 1) return modulosEfectivos[0];

  const cookieStore = await cookies();
  const elegido = cookieStore.get(COOKIE_MODULO_ACTUAL)?.value as Modulo | undefined;
  return elegido && modulosEfectivos.includes(elegido) ? elegido : modulosEfectivos[0];
}

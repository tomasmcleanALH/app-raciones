import { createClient } from "@/lib/supabase/client";
import type { Alimento, Lote } from "@/lib/types";

const KEY_LOTES = "app-raciones:cache:lotes";
const KEY_ALIMENTOS = "app-raciones:cache:alimentos";

async function conCache<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  try {
    const datos = await fetcher();
    localStorage.setItem(key, JSON.stringify(datos));
    return datos;
  } catch (err) {
    const cache = localStorage.getItem(key);
    if (cache) return JSON.parse(cache) as T;
    throw err;
  }
}

/** Lotes activos. Si no hay señal, devuelve la última lista vista (guardada en el celular). */
export async function getLotesActivos(): Promise<Lote[]> {
  return conCache(KEY_LOTES, async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("lotes")
      .select("*")
      .eq("activo", true)
      .order("nombre");
    if (error) throw error;
    return data as Lote[];
  });
}

/** Alimentos activos. Si no hay señal, devuelve la última lista vista (guardada en el celular). */
export async function getAlimentosActivos(): Promise<Alimento[]> {
  return conCache(KEY_ALIMENTOS, async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("alimentos")
      .select("*")
      .eq("activo", true)
      .order("nombre");
    if (error) throw error;
    return data as Alimento[];
  });
}

import { createClient } from "@/lib/supabase/client";
import type { Alimento, Lote, Material } from "@/lib/types";

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

/** Lotes activos del campo. Si no hay señal, devuelve la última lista vista (guardada en el celular). */
export async function getLotesActivos(campoId: string): Promise<Lote[]> {
  return conCache(`app-raciones:cache:lotes:${campoId}`, async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("lotes")
      .select("*")
      .eq("campo_id", campoId)
      .eq("activo", true)
      .order("nombre");
    if (error) throw error;
    return data as Lote[];
  });
}

/** Alimentos activos del campo. Si no hay señal, devuelve la última lista vista (guardada en el celular). */
export async function getAlimentosActivos(campoId: string): Promise<Alimento[]> {
  return conCache(`app-raciones:cache:alimentos:${campoId}`, async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("alimentos")
      .select("*")
      .eq("campo_id", campoId)
      .eq("activo", true)
      .order("nombre");
    if (error) throw error;
    return data as Alimento[];
  });
}

/** Materiales activos del campo (módulo Stock de materiales). */
export async function getMaterialesActivos(campoId: string): Promise<Material[]> {
  return conCache(`app-raciones:cache:materiales:${campoId}`, async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("materiales")
      .select("*")
      .eq("campo_id", campoId)
      .eq("activo", true)
      .order("nombre");
    if (error) throw error;
    return data as Material[];
  });
}

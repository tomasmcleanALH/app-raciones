import { createClient } from "@/lib/supabase/client";
import type { Alimento, BolsonAlimento, Contratista, Lote, LoteMaterial, Material, Proveedor, UbicacionAlimento } from "@/lib/types";

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

/** Ubicaciones de stock de alimentos activas del campo. Si no hay señal, devuelve la última lista vista. */
export async function getUbicacionesActivas(campoId: string): Promise<UbicacionAlimento[]> {
  return conCache(`app-raciones:cache:ubicaciones_alimentos:${campoId}`, async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("ubicaciones_alimentos")
      .select("*")
      .eq("campo_id", campoId)
      .eq("activo", true)
      .order("nombre");
    if (error) throw error;
    return data as UbicacionAlimento[];
  });
}

/** Bolsones de alimentos activos del campo (sub-ubicación opcional). Si no hay señal, devuelve la última lista vista. */
export async function getBolsonesActivos(campoId: string): Promise<BolsonAlimento[]> {
  return conCache(`app-raciones:cache:bolsones_alimentos:${campoId}`, async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("bolsones_alimentos")
      .select("*")
      .eq("campo_id", campoId)
      .eq("activo", true)
      .order("nombre");
    if (error) throw error;
    return data as BolsonAlimento[];
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

/** Proveedores activos del campo (módulo Stock de materiales). */
export async function getProveedoresActivos(campoId: string): Promise<Proveedor[]> {
  return conCache(`app-raciones:cache:proveedores:${campoId}`, async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("proveedores")
      .select("*")
      .eq("campo_id", campoId)
      .eq("activo", true)
      .order("nombre");
    if (error) throw error;
    return data as Proveedor[];
  });
}

/** Contratistas activos del campo (módulo Stock de materiales). */
export async function getContratistasActivos(campoId: string): Promise<Contratista[]> {
  return conCache(`app-raciones:cache:contratistas:${campoId}`, async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("contratistas")
      .select("*")
      .eq("campo_id", campoId)
      .eq("activo", true)
      .order("nombre");
    if (error) throw error;
    return data as Contratista[];
  });
}

/** Lotes (del módulo Materiales, separados de los de Alimentos) activos del campo. */
export async function getLotesMaterialesActivos(campoId: string): Promise<LoteMaterial[]> {
  return conCache(`app-raciones:cache:lotes_materiales:${campoId}`, async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("lotes_materiales")
      .select("*")
      .eq("campo_id", campoId)
      .eq("activo", true)
      .order("nombre");
    if (error) throw error;
    return data as LoteMaterial[];
  });
}

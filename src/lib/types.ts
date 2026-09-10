export type Rol = "tractorista" | "encargado" | "gerente";

export interface Profile {
  id: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
  created_at: string;
}

export interface Lote {
  id: string;
  nombre: string;
  activo: boolean;
  created_at: string;
}

export interface Alimento {
  id: string;
  nombre: string;
  activo: boolean;
  created_at: string;
}

export interface Entrega {
  id: string;
  client_id: string;
  fecha_entrega: string; // YYYY-MM-DD
  lote_id: string;
  alimento_id: string;
  cantidad: number;
  unidad: string;
  observaciones: string | null;
  cargado_por: string;
  created_at: string;
}

/** Entrega con los nombres ya resueltos, para mostrar en la grilla. */
export interface EntregaConNombres extends Entrega {
  lote_nombre: string;
  alimento_nombre: string;
  cargado_por_nombre: string;
}

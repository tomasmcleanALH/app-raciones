export type Rol = "tractorista" | "encargado" | "gerente" | "dueno";

/** A qué módulo tiene acceso un usuario. El Dueño siempre tiene ambos. */
export type Modulo = "alimentos" | "materiales";

export interface Profile {
  id: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
  created_at: string;
}

export interface Campo {
  id: string;
  nombre: string;
  activo: boolean;
  created_at: string;
}

export interface Lote {
  id: string;
  campo_id: string;
  nombre: string;
  activo: boolean;
  created_at: string;
}

export interface Alimento {
  id: string;
  campo_id: string;
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

// ------------------------------------------------------------
// Módulo Stock de materiales (materiales, movimientos de entrada/salida)
// ------------------------------------------------------------

export interface Material {
  id: string;
  campo_id: string;
  nombre: string;
  activo: boolean;
  created_at: string;
}

export type TipoMovimiento = "entrada" | "salida";

export interface MovimientoStock {
  id: string;
  fecha: string; // YYYY-MM-DD
  material_id: string;
  tipo: TipoMovimiento;
  cantidad: number;
  unidad: string;
  observaciones: string | null;
  cargado_por: string;
  created_at: string;
}

/** Movimiento de stock con los nombres ya resueltos, para mostrar en la grilla. */
export interface MovimientoStockConNombres extends MovimientoStock {
  material_nombre: string;
  cargado_por_nombre: string;
}

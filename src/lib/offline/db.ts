import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export interface EntregaPendiente {
  client_id: string;
  fecha_entrega: string;
  lote_id: string;
  alimento_id: string;
  cantidad: number;
  unidad: string;
  ubicacion_id: string | null;
  bolson_id: string | null;
  observaciones: string | null;
  cargado_por: string;
  creada_en: string; // timestamp local, para ordenar
  intentos: number;
  ultimo_error?: string;
}

export interface MovimientoPendiente {
  client_id: string;
  fecha: string;
  material_id: string;
  tipo: "entrada" | "salida";
  cantidad: number;
  unidad: string;
  proveedor_id: string | null;
  contratista_id: string | null;
  lote_material_id: string | null;
  observaciones: string | null;
  cargado_por: string;
  creada_en: string; // timestamp local, para ordenar
  intentos: number;
  ultimo_error?: string;
}

interface AppRacionesDB extends DBSchema {
  entregas_pendientes: {
    key: string; // client_id
    value: EntregaPendiente;
  };
  movimientos_pendientes: {
    key: string; // client_id
    value: MovimientoPendiente;
  };
}

let dbPromise: Promise<IDBPDatabase<AppRacionesDB>> | null = null;

function getDb() {
  if (typeof window === "undefined") {
    throw new Error("El almacenamiento offline sólo existe en el navegador.");
  }
  if (!dbPromise) {
    dbPromise = openDB<AppRacionesDB>("app-raciones", 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore("entregas_pendientes", { keyPath: "client_id" });
        }
        if (oldVersion < 2) {
          db.createObjectStore("movimientos_pendientes", { keyPath: "client_id" });
        }
      },
    });
  }
  return dbPromise;
}

export async function guardarEntregaPendiente(entrega: EntregaPendiente) {
  const db = await getDb();
  await db.put("entregas_pendientes", entrega);
}

export async function listarEntregasPendientes(): Promise<EntregaPendiente[]> {
  const db = await getDb();
  const todas = await db.getAll("entregas_pendientes");
  return todas.sort((a, b) => a.creada_en.localeCompare(b.creada_en));
}

export async function borrarEntregaPendiente(clientId: string) {
  const db = await getDb();
  await db.delete("entregas_pendientes", clientId);
}

export async function marcarIntentoFallido(clientId: string, error: string) {
  const db = await getDb();
  const actual = await db.get("entregas_pendientes", clientId);
  if (!actual) return;
  actual.intentos += 1;
  actual.ultimo_error = error;
  await db.put("entregas_pendientes", actual);
}

export async function guardarMovimientoPendiente(movimiento: MovimientoPendiente) {
  const db = await getDb();
  await db.put("movimientos_pendientes", movimiento);
}

export async function listarMovimientosPendientes(): Promise<MovimientoPendiente[]> {
  const db = await getDb();
  const todos = await db.getAll("movimientos_pendientes");
  return todos.sort((a, b) => a.creada_en.localeCompare(b.creada_en));
}

export async function borrarMovimientoPendiente(clientId: string) {
  const db = await getDb();
  await db.delete("movimientos_pendientes", clientId);
}

export async function marcarIntentoMovimientoFallido(clientId: string, error: string) {
  const db = await getDb();
  const actual = await db.get("movimientos_pendientes", clientId);
  if (!actual) return;
  actual.intentos += 1;
  actual.ultimo_error = error;
  await db.put("movimientos_pendientes", actual);
}

/** Total de registros (entregas + movimientos de stock) esperando subir. */
export async function contarPendientes(): Promise<number> {
  const db = await getDb();
  const [entregas, movimientos] = await Promise.all([
    db.count("entregas_pendientes"),
    db.count("movimientos_pendientes"),
  ]);
  return entregas + movimientos;
}

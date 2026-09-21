import { createAdminClient } from "@/lib/supabase/server";
import { ApiError } from "./http";

/**
 * Acceso a datos de la API de solo lectura. Este es el ÚNICO lugar donde
 * /api/v1 toca la base: usa la clave de servicio (salta RLS), por eso acá
 * sólo hay consultas .select(); nunca insert, update, delete ni rpc.
 */

export const MODULOS = ["alimentos", "materiales"] as const;
export type Modulo = (typeof MODULOS)[number];

export const CODIGOS_CAMPO = ["san-jorge", "san-jose", "el-nene", "las-isletas", "santa-teresita"] as const;

const PAGINA = 1000; // filas por pedido a la base (tope de Supabase)

// --- Utilidades ------------------------------------------------------------

/** Trae todas las filas de una consulta, pidiendo de a páginas. */
async function traerTodo<T = any>(
  armar: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const filas: T[] = [];
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await armar(desde, desde + PAGINA - 1);
    if (error) throw new Error(error.message);
    filas.push(...(data ?? []));
    if (!data || data.length < PAGINA) return filas;
  }
}

function num(v: unknown) {
  return Math.round(Number(v) * 100) / 100;
}

/** Timestamp de la base -> "YYYY-MM-DDTHH:mm:ss.ffffffZ" (UTC, 6 decimales,
 * comparable como texto). Se usa internamente y en el cursor. */
function normTs(s: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]00(?::?00)?)$/.exec(s);
  if (m) return `${m[1]}T${m[2]}.${(m[3] ?? "").padEnd(6, "0")}Z`;
  return new Date(s).toISOString().replace("Z", "000Z");
}

/** Lo que se le muestra al consumidor: ISO con milisegundos. */
function tsPublico(s: string | null | undefined): string | null {
  return s ? normTs(s).slice(0, 23) + "Z" : null;
}

// --- Catálogos --------------------------------------------------------------

interface Producto {
  id: string;
  modulo: Modulo;
  nombre: string;
  rubro: string | null;
  activo: boolean;
  campo_id: string;
}

interface Catalogos {
  campos: { id: string; codigo: string | null; nombre: string; activo: boolean }[];
  codigoDeCampo: Map<string, string | null>;
  productos: Producto[];
  producto: Map<string, Producto>; // por id (uuid: no se repiten entre módulos)
}

async function cargarCatalogos(): Promise<Catalogos> {
  const db = createAdminClient();
  const [campos, alimentos, materiales] = await Promise.all([
    traerTodo((d, h) => db.from("campos").select("id, nombre, codigo, activo").order("id").range(d, h)),
    traerTodo((d, h) =>
      db.from("alimentos").select("id, nombre, activo, campo_id, categorias_alimentos(nombre)").order("id").range(d, h),
    ),
    traerTodo((d, h) =>
      db.from("materiales").select("id, nombre, activo, campo_id, categorias_materiales(nombre)").order("id").range(d, h),
    ),
  ]);

  const productos: Producto[] = [
    ...alimentos.map((a: any) => ({
      id: a.id,
      modulo: "alimentos" as const,
      nombre: a.nombre,
      rubro: a.categorias_alimentos?.nombre ?? null,
      activo: a.activo,
      campo_id: a.campo_id,
    })),
    ...materiales.map((m: any) => ({
      id: m.id,
      modulo: "materiales" as const,
      nombre: m.nombre,
      rubro: m.categorias_materiales?.nombre ?? null,
      activo: m.activo,
      campo_id: m.campo_id,
    })),
  ];

  return {
    campos,
    codigoDeCampo: new Map(campos.map((c: any) => [c.id, c.codigo])),
    productos,
    producto: new Map(productos.map((p) => [p.id, p])),
  };
}

function campoIdPorCodigo(cat: Catalogos, codigo: string | null): string | null | undefined {
  if (!codigo) return undefined; // sin filtro
  return cat.campos.find((c) => c.codigo === codigo)?.id ?? null; // null: el campo todavía no existe
}

// --- /campos ---------------------------------------------------------------

export async function listarCampos() {
  const cat = await cargarCatalogos();
  return {
    datos: cat.campos
      .filter((c) => c.codigo)
      .sort((a, b) => a.codigo!.localeCompare(b.codigo!))
      .map((c) => ({ codigo: c.codigo, nombre: c.nombre, activo: c.activo })),
  };
}

// --- Stock -----------------------------------------------------------------

interface GrupoStock {
  producto: Producto;
  unidad: string;
  ubicacion_id: string | null;
  cantidad: number;
  actualizado: string; // timestamp normalizado
}

/** Stock = entradas - salidas de cada producto (por unidad). El "actualizado"
 * es el último movimiento (o borrado de un movimiento) que lo tocó. */
async function calcularStock(cat: Catalogos, porUbicacion: boolean): Promise<GrupoStock[]> {
  const db = createAdminClient();
  const [entradas, entregas, movimientos, borrados] = await Promise.all([
    traerTodo((d, h) =>
      db.from("entradas_alimentos").select("alimento_id, cantidad, unidad, ubicacion_id, updated_at").order("id").range(d, h),
    ),
    traerTodo((d, h) =>
      db.from("entregas").select("alimento_id, cantidad, unidad, ubicacion_id, updated_at").order("id").range(d, h),
    ),
    traerTodo((d, h) =>
      db.from("movimientos_stock").select("material_id, tipo, cantidad, unidad, updated_at").order("id").range(d, h),
    ),
    traerTodo((d, h) => db.from("eliminaciones").select("tabla, datos, eliminado_en").order("id").range(d, h)),
  ]);

  const grupos = new Map<string, GrupoStock>();
  function sumar(productoId: string, unidad: string, ubicacionId: string | null, delta: number, ts: string) {
    const producto = cat.producto.get(productoId);
    if (!producto) return;
    const ubic = porUbicacion ? ubicacionId : null;
    const clave = `${productoId}|${unidad}|${ubic ?? ""}`;
    const t = normTs(ts);
    const g = grupos.get(clave);
    if (g) {
      g.cantidad += delta;
      if (t > g.actualizado) g.actualizado = t;
    } else {
      grupos.set(clave, { producto, unidad, ubicacion_id: ubic, cantidad: delta, actualizado: t });
    }
  }

  for (const e of entradas) sumar(e.alimento_id, e.unidad, e.ubicacion_id, Number(e.cantidad), e.updated_at);
  for (const s of entregas) sumar(s.alimento_id, s.unidad, s.ubicacion_id, -Number(s.cantidad), s.updated_at);
  for (const m of movimientos) {
    sumar(m.material_id, m.unidad, null, m.tipo === "entrada" ? Number(m.cantidad) : -Number(m.cantidad), m.updated_at);
  }
  // Un movimiento borrado ya no suma, pero el stock sí cambió en ese momento.
  for (const b of borrados) {
    const d = b.datos ?? {};
    const productoId = b.tabla === "movimientos_stock" ? d.material_id : d.alimento_id;
    const producto = cat.producto.get(productoId);
    if (!producto) continue;
    const ubic = porUbicacion && b.tabla !== "movimientos_stock" ? (d.ubicacion_id ?? null) : null;
    const g = grupos.get(`${productoId}|${d.unidad}|${ubic ?? ""}`);
    const t = normTs(b.eliminado_en);
    if (g && t > g.actualizado) g.actualizado = t;
  }

  return [...grupos.values()];
}

export async function listarProductos(filtros: { modulo: Modulo | null; campo: string | null }) {
  const cat = await cargarCatalogos();
  const campoId = campoIdPorCodigo(cat, filtros.campo);
  const stock = await calcularStock(cat, false);

  const unidades = new Map<string, Set<string>>();
  for (const g of stock) {
    const s = unidades.get(g.producto.id) ?? new Set<string>();
    s.add(g.unidad);
    unidades.set(g.producto.id, s);
  }

  const datos = cat.productos
    .filter((p) => (!filtros.modulo || p.modulo === filtros.modulo) && (campoId === undefined || p.campo_id === campoId))
    .sort((a, b) => a.modulo.localeCompare(b.modulo) || a.nombre.localeCompare(b.nombre))
    .map((p) => ({
      id: p.id,
      modulo: p.modulo,
      nombre: p.nombre,
      rubro: p.rubro,
      unidades: [...(unidades.get(p.id) ?? [])].sort(),
      activo: p.activo,
      campo: cat.codigoDeCampo.get(p.campo_id) ?? null,
    }));
  return { datos };
}

export async function listarStock(filtros: {
  modulo: Modulo | null;
  campo: string | null;
  productoId: string | null;
  detalleUbicacion: boolean;
}) {
  const cat = await cargarCatalogos();
  const campoId = campoIdPorCodigo(cat, filtros.campo);
  const db = createAdminClient();
  const ubicaciones = filtros.detalleUbicacion
    ? new Map(
        (await traerTodo((d, h) => db.from("ubicaciones_alimentos").select("id, nombre").order("id").range(d, h))).map(
          (u: any) => [u.id, u.nombre as string],
        ),
      )
    : null;

  const grupos = await calcularStock(cat, filtros.detalleUbicacion);
  const datos = grupos
    .filter(
      (g) =>
        (!filtros.modulo || g.producto.modulo === filtros.modulo) &&
        (campoId === undefined || g.producto.campo_id === campoId) &&
        (!filtros.productoId || g.producto.id === filtros.productoId),
    )
    .sort(
      (a, b) =>
        a.producto.modulo.localeCompare(b.producto.modulo) ||
        a.producto.nombre.localeCompare(b.producto.nombre) ||
        a.unidad.localeCompare(b.unidad) ||
        (a.ubicacion_id ?? "").localeCompare(b.ubicacion_id ?? ""),
    )
    .map((g) => ({
      modulo: g.producto.modulo,
      campo: cat.codigoDeCampo.get(g.producto.campo_id) ?? null,
      producto_id: g.producto.id,
      producto: g.producto.nombre,
      rubro: g.producto.rubro,
      activo: g.producto.activo,
      unidad: g.unidad,
      cantidad: num(g.cantidad),
      ...(ubicaciones
        ? { ubicacion_id: g.ubicacion_id, ubicacion: g.ubicacion_id ? (ubicaciones.get(g.ubicacion_id) ?? null) : null }
        : {}),
      actualizado_en: tsPublico(g.actualizado),
    }));
  return { datos };
}

// --- Movimientos -------------------------------------------------------------

type Tipo = "entrada" | "salida";

interface Fuente {
  tabla: "entradas_alimentos" | "entregas" | "movimientos_stock";
  modulo: Modulo;
  productoCol: "alimento_id" | "material_id";
  productoTabla: "alimentos" | "materiales";
  fechaCol: "fecha" | "fecha_entrega";
  tipoFijo: Tipo | null; // null: viene en la fila (movimientos_stock)
}

const FUENTES: Fuente[] = [
  { tabla: "entradas_alimentos", modulo: "alimentos", productoCol: "alimento_id", productoTabla: "alimentos", fechaCol: "fecha", tipoFijo: "entrada" },
  { tabla: "entregas", modulo: "alimentos", productoCol: "alimento_id", productoTabla: "alimentos", fechaCol: "fecha_entrega", tipoFijo: "salida" },
  { tabla: "movimientos_stock", modulo: "materiales", productoCol: "material_id", productoTabla: "materiales", fechaCol: "fecha", tipoFijo: null },
];

interface Item {
  ts: string; // normalizado, para ordenar y para el cursor
  id: string;
  fuente: Fuente;
  fila: any;
  eliminado: boolean;
}

interface Cursor {
  ts: string;
  id: string;
}

function decodificarCursor(valor: string | null): Cursor | null {
  if (!valor) return null;
  try {
    const c = JSON.parse(Buffer.from(valor, "base64url").toString("utf8"));
    if (typeof c.ts === "string" && typeof c.id === "string" && !Number.isNaN(Date.parse(c.ts))) return c;
  } catch {}
  throw new ApiError(400, "parametro_invalido", '"cursor" no es válido: usá el "siguiente_cursor" que devolvió la API.');
}

function codificarCursor(c: Cursor) {
  return Buffer.from(JSON.stringify(c)).toString("base64url");
}

export async function listarMovimientos(filtros: {
  modulo: Modulo | null;
  campo: string | null;
  tipo: Tipo | null;
  cambiadosDesde: string | null;
  limite: number;
  cursor: string | null;
}) {
  const cat = await cargarCatalogos();
  const campoId = campoIdPorCodigo(cat, filtros.campo);
  if (campoId === null) return { datos: [], siguiente_cursor: null }; // campo válido pero todavía sin cargar

  const cursor = decodificarCursor(filtros.cursor);
  const db = createAdminClient();
  const fuentes = FUENTES.filter(
    (f) => (!filtros.modulo || f.modulo === filtros.modulo) && (!filtros.tipo || !f.tipoFijo || f.tipoFijo === filtros.tipo),
  );
  const items: Item[] = [];

  // Registros vigentes (creados o modificados).
  await Promise.all(
    fuentes.map(async (f) => {
      const cols = `id, ${f.productoCol}, ${f.fechaCol}, cantidad, unidad, created_at, updated_at${f.tipoFijo ? "" : ", tipo"}`;
      let q = db.from(f.tabla).select(`${cols}, ${f.productoTabla}!inner(campo_id)`);
      if (campoId) q = q.eq(`${f.productoTabla}.campo_id`, campoId);
      if (!f.tipoFijo && filtros.tipo) q = q.eq("tipo", filtros.tipo);
      if (filtros.cambiadosDesde) q = q.gte("updated_at", filtros.cambiadosDesde);
      if (cursor) q = q.or(`updated_at.gt.${cursor.ts},and(updated_at.eq.${cursor.ts},id.gt.${cursor.id})`);
      const { data, error } = await q.order("updated_at").order("id").limit(filtros.limite + 1);
      if (error) throw new Error(error.message);
      for (const fila of data ?? []) items.push({ ts: normTs((fila as any).updated_at), id: (fila as any).id, fuente: f, fila, eliminado: false });
    }),
  );

  // Registros borrados (anulados).
  if (fuentes.length > 0) {
    let q = db.from("eliminaciones").select("tabla, registro_id, datos, eliminado_en").in("tabla", fuentes.map((f) => f.tabla));
    if (filtros.cambiadosDesde) q = q.gte("eliminado_en", filtros.cambiadosDesde);
    if (cursor) q = q.or(`eliminado_en.gt.${cursor.ts},and(eliminado_en.eq.${cursor.ts},registro_id.gt.${cursor.id})`);
    const { data, error } = await q.order("eliminado_en").order("registro_id").limit(filtros.limite + 1);
    if (error) throw new Error(error.message);
    for (const b of data ?? []) {
      const f = fuentes.find((x) => x.tabla === b.tabla)!;
      items.push({ ts: normTs(b.eliminado_en), id: b.registro_id, fuente: f, fila: b, eliminado: true });
    }
  }

  items.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const hayMas = items.length > filtros.limite;
  const pagina = items.slice(0, filtros.limite);
  const ultimo = pagina[pagina.length - 1];

  const datos = pagina
    .map((it) => {
      const f = it.fuente;
      const d = it.eliminado ? it.fila.datos : it.fila;
      const producto = cat.producto.get(d[f.productoCol]);
      return {
        id: it.id,
        modulo: f.modulo,
        tipo: f.tipoFijo ?? d.tipo,
        fecha: d[f.fechaCol],
        producto_id: d[f.productoCol],
        producto: producto?.nombre ?? null,
        cantidad: num(d.cantidad),
        unidad: d.unidad,
        campo: producto ? (cat.codigoDeCampo.get(producto.campo_id) ?? null) : null,
        creado_en: tsPublico(d.created_at),
        actualizado_en: tsPublico(d.updated_at ?? d.created_at),
        anulado: it.eliminado,
        anulado_en: it.eliminado ? tsPublico(it.fila.eliminado_en) : null,
        _campoId: producto?.campo_id,
        _tipo: f.tipoFijo ?? d.tipo,
      };
    })
    // Los borrados no se pudieron filtrar en la base: se filtran acá.
    .filter((m, i) => !pagina[i].eliminado || ((campoId === undefined || m._campoId === campoId) && (!filtros.tipo || m._tipo === filtros.tipo)))
    .map(({ _campoId, _tipo, ...m }) => m);

  return {
    datos,
    siguiente_cursor: hayMas && ultimo ? codificarCursor({ ts: ultimo.ts, id: ultimo.id }) : null,
  };
}

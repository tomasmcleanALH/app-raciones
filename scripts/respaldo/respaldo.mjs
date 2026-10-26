// Herramientas del respaldo diario (las usa .github/workflows/respaldo-diario.yml).
//
//   node respaldo.mjs contar   <url-base> <salida.json>
//       Cuenta las filas de cada tabla de "public" (y de auth.users / auth.identities).
//   node respaldo.mjs exportar <url-base> <salida.json>
//       Vuelca todas las tablas de "public" a un JSON legible (copia de emergencia
//       que se puede abrir sin Postgres).
//   node respaldo.mjs comparar <antes.json> <despues.json> <restaurado.json>
//       Verifica que la base restaurada tenga las mismas tablas y la misma cantidad
//       de filas que el origen. Sale con error (código 1) si no coincide.

import fs from "node:fs";
import pg from "pg";

const TABLAS_AUTH = ["users", "identities"];

async function conectar(url) {
  const u = new URL(url);
  const local = ["localhost", "127.0.0.1", "::1"].includes(u.hostname);
  // Se saca sslmode de la URL para que lo decida el objeto "ssl" de abajo:
  // el pooler de Supabase usa su propio certificado, que no está en el
  // almacén del sistema, y con verificación estricta fallaría.
  u.searchParams.delete("sslmode");
  const client = new pg.Client({
    connectionString: u.toString(),
    ssl: local ? false : { rejectUnauthorized: false },
  });
  try {
    await client.connect();
  } catch (err) {
    // Pista para armar bien el secret, sin mostrar nada sensible (ni la
    // contraseña, ni el código del proyecto).
    const pooler = u.hostname.includes("pooler.supabase.com");
    const pistas = [
      `usuario: ${u.username ? u.username.split(".")[0] : "(vacío)"}${u.username.includes(".") ? " + código del proyecto" : " (SIN código del proyecto)"}`,
      `host de pooler: ${pooler ? "sí" : "NO"}`,
      `puerto: ${u.port || "(ninguno)"}`,
      `largo de la contraseña leída: ${decodeURIComponent(u.password).length}`,
      `contiene corchetes: ${/[\[\]]/.test(decodeURIComponent(u.password)) ? "SÍ (sacarlos)" : "no"}`,
    ];
    throw new Error(`${err.message}\n  Lo que se leyó de RESPALDO_DB_URL -> ${pistas.join(" | ")}`);
  }
  return client;
}

async function listarTablas(client) {
  const { rows } = await client.query(
    `select table_schema, table_name
       from information_schema.tables
      where table_type = 'BASE TABLE'
        and (table_schema = 'public'
             or (table_schema = 'auth' and table_name = any($1)))
      order by 1, 2`,
    [TABLAS_AUTH],
  );
  return rows;
}

async function contar(url, salida) {
  const client = await conectar(url);
  try {
    const resultado = {};
    for (const { table_schema, table_name } of await listarTablas(client)) {
      const { rows } = await client.query(
        `select count(*)::bigint as n from ${pg.escapeIdentifier(table_schema)}.${pg.escapeIdentifier(table_name)}`,
      );
      resultado[`${table_schema}.${table_name}`] = Number(rows[0].n);
    }
    fs.writeFileSync(salida, JSON.stringify(resultado, null, 2));
    console.log(`Contadas ${Object.keys(resultado).length} tablas.`);
  } finally {
    await client.end();
  }
}

async function exportar(url, salida) {
  const client = await conectar(url);
  try {
    // Una sola foto consistente de todas las tablas.
    await client.query("begin transaction isolation level repeatable read read only");
    const tablas = {};
    for (const { table_schema, table_name } of await listarTablas(client)) {
      if (table_schema !== "public") continue;
      const { rows } = await client.query(
        `select * from ${pg.escapeIdentifier(table_schema)}.${pg.escapeIdentifier(table_name)}`,
      );
      tablas[table_name] = rows;
    }
    await client.query("commit");
    fs.writeFileSync(salida, JSON.stringify({ generado: new Date().toISOString(), tablas }));
    console.log(`Exportadas ${Object.keys(tablas).length} tablas.`);
  } finally {
    await client.end();
  }
}

function comparar(archivoAntes, archivoDespues, archivoRestaurado) {
  const antes = JSON.parse(fs.readFileSync(archivoAntes, "utf8"));
  const despues = JSON.parse(fs.readFileSync(archivoDespues, "utf8"));
  const restaurado = JSON.parse(fs.readFileSync(archivoRestaurado, "utf8"));

  const problemas = [];
  const nombres = Object.keys(antes);
  if (nombres.length === 0) problemas.push("El origen no devolvió ninguna tabla.");

  let filas = 0;
  for (const tabla of nombres) {
    if (!(tabla in restaurado)) {
      problemas.push(`Falta la tabla ${tabla} en la base restaurada.`);
      continue;
    }
    // La copia se saca mientras la app sigue en uso: una fila nueva (o borrada)
    // entre el conteo y la copia es normal. Lo que no es normal es quedar
    // fuera del rango que tuvo el origen mientras duró el respaldo.
    const a = antes[tabla];
    const d = despues[tabla] ?? a;
    const r = restaurado[tabla];
    filas += r;
    if (r < Math.min(a, d) || r > Math.max(a, d)) {
      problemas.push(`${tabla}: origen ${a}→${d} filas, restaurado ${r}.`);
    }
  }

  if (problemas.length > 0) {
    console.error("La restauración NO coincide con el origen:");
    for (const p of problemas) console.error(` - ${p}`);
    process.exit(1);
  }
  console.log(`Restauración verificada: ${nombres.length} tablas, ${filas} filas.`);
}

const [comando, ...args] = process.argv.slice(2);

try {
  if (comando === "contar" && args.length === 2) await contar(...args);
  else if (comando === "exportar" && args.length === 2) await exportar(...args);
  else if (comando === "comparar" && args.length === 3) comparar(...args);
  else {
    console.error("Uso: respaldo.mjs contar|exportar <url> <salida.json>  |  comparar <antes> <despues> <restaurado>");
    process.exit(2);
  }
} catch (err) {
  console.error(`Error en "${comando}": ${err.message}`);
  process.exit(1);
}

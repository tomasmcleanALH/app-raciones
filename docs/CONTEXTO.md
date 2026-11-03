# Contexto del proyecto (para retomar el trabajo con Claude)

Este archivo resume lo que hay que saber para seguir trabajando en la app sin haber estado en las
conversaciones anteriores. **No contiene claves ni contraseñas** (sólo los nombres de dónde están).
Última actualización: 3/11/2026.

## Quién y cómo trabajar

- **Tomas Mclean**, dueño de Agropecuaria Las Helenas. No es programador: las respuestas tienen que
  ser en **español rioplatense, cortas y claras**, sin jerga innecesaria.
- Toda la interfaz de la app está en español.
- **Antes de subir a producción, preguntar** ("¿lo subo?"). Siempre lo autoriza explícitamente
  ("sí, subilo"). Commits en `main`; Vercel despliega solo al hacer push.
- Cuando algo se puede **probar o comprobar**, hacerlo y mostrar el resultado en vez de pedirle que
  lo revise a mano. Decir con claridad qué se probó y qué no.
- **Nunca** pedirle ni pegar contraseñas, tokens o claves en el chat. Si hay que pasarle un secreto,
  se genera/copia al portapapeles sin mostrarlo.
- No tocar la carpeta `COPIA DE SEGURIDAD/` de la raíz (sin seguir en git; tiene un `contraseña.txt`).
  **Nunca hacer `git add .`**: agregar los archivos por nombre.

## Qué es la app

"Operaciones": registro de stock y movimientos para los campos de la empresa. Dos módulos:

- **Alimentos**: entradas (compras/llegadas) y **entregas** de alimento a lotes. Lo usan los
  tractoristas en el campo, muchas veces **sin señal**.
- **Materiales** ("Stock de materiales"): movimientos de entrada/salida de materiales
  (proveedores, contratistas, lotes de materiales).

Stack: **Next.js 16** (tiene cambios incompatibles con lo que se conoce: leer
`node_modules/next/dist/docs/` antes de escribir código, ver `AGENTS.md`), React 19, Tailwind 4,
**Supabase** (Postgres + Auth + RLS), **Vercel**, `idb` para lo offline. En Next 16 el
"middleware" se llama `proxy` (`src/proxy.ts`).

- Repo: https://github.com/tomasmcleanALH/app-raciones (rama `main`)
- Producción: https://app-operaciones.vercel.app
- **No hay entorno de prueba.** El desarrollo local y producción usan **la misma base de datos de
  producción**. Cualquier cosa que se escriba en la base desde un script o desde `npm run dev` es real.

## Modelo de datos y permisos

- **Campos** (`campos`): San Jorge (sólo Alimentos), Las Isletas (Alimentos + Materiales),
  El Nene (sólo Alimentos; creado en octubre de 2026 desde la pantalla de Campos, sin tocar código).
  Cada campo tiene un `codigo` (ej. `el-nene`) que se arma solo con un trigger y lo usa la API.
- **Roles** (`profiles.rol`): `tractorista` (en pantalla "Usuario"), `encargado` ("Administrador"
  del campo), `gerente` (sólo lectura) y `dueno` (ve y administra todo).
- **Módulos**: se habilitan **por usuario** (`usuarios_modulos`) **y por campo** (`campo_modulos`);
  el acceso real es la **intersección** (`src/lib/modulos.ts`). El dueño tiene todos los módulos.
  Crear un campo desde la app lo deja con Alimentos; Materiales se prende con un interruptor.
- RLS en todas las tablas, con funciones auxiliares (`tiene_acceso_a_campo`, `es_admin_de_campo`,
  `campo_tiene_modulo`, etc.). El esquema completo está en `supabase/schema.sql`.
- Alimentos: `lotes`, `alimentos` (con categoría), `entradas_alimentos` (con proveedor, ubicación,
  bolsón), `entregas` (con lote, alimento, ubicación opcional), `ubicaciones_alimentos`,
  `bolsones_alimentos`, `proveedores_alimentos`. Materiales: `materiales`, `movimientos_stock`,
  `proveedores`, `contratistas`, `lotes_materiales`, categorías.
- **Stock de Alimentos** = entradas − entregas. Se muestra por ubicación (y bolsón) de la entrada.
  La entrega indica de qué ubicación sale **sólo si el campo tiene más de una ubicación activa**
  (si hay una sola, se asigna sola). Las entregas viejas sin ubicación se descuentan de lo que haya
  del alimento, empezando por lo que entró primero (`StockDisponibleAlimentos.tsx`).
- Categorías "rollo"/"insumo" se controlan por total (sin ubicación ni bolsón).

## Migraciones

Están en `supabase/migrations/` (002 a 014). **No hay CLI de Supabase conectada:** Tomas las pega
a mano en Supabase → SQL Editor → Run. Un archivo nuevo en el repo **no** modifica la base.

- **014** (`nombres_unicos_por_campo`): saca la restricción vieja que hacía único el nombre de
  lotes y alimentos en toda la base (debe ser único por campo). **Confirmar con Tomas si ya la
  corrió**; hasta entonces no se puede repetir un alimento/lote entre campos (error "Ya existe uno
  con ese nombre").

## Cómo se comprueban cosas en la base (sin riesgo)

Script temporal de Node con `@supabase/supabase-js` y la clave de servicio de `.env.local`
(`SUPABASE_SERVICE_ROLE_KEY`), **de sólo lectura**. Tiene que estar en la **raíz del proyecto**
(si está en otra carpeta no resuelve los paquetes) y **borrarse al terminar**. `.env.local` tiene
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`; las
claves de producción están también en Vercel.

## Offline (lo más importante pendiente)

Cómo funciona hoy:
- `public/sw.js`: service worker que guarda el "cascarón" de las pantallas visitadas (primero red,
  si falla usa la copia). No cachea Supabase ni `/api/`. Versión de caché `app-raciones-v2`.
- `src/lib/offline/`: `db.ts` (IndexedDB: `entregas_pendientes`, `movimientos_pendientes`),
  `sync.ts` (sube lo pendiente al volver la señal, cada 30 s y al abrir; usa `client_id` único para
  no duplicar), `catalogos.ts` (lotes, alimentos, ubicaciones, materiales, etc. guardados en
  `localStorage` la última vez que se abrieron con señal).
- Funciona sin señal: **Cargar entrega** (Alimentos) y **Cargar movimiento de stock** (Materiales).
- Ya corregidos: botón trabado en "Entrando..." al elegir campo/módulo sin señal, y "vuelve al
  campo" al elegir módulo sin señal.

Huecos conocidos (Tomas pidió que funcione **100% offline**; estaba esperando su visto bueno para
empezar por el paso 1):
1. Señal mala (no nula): ni las páginas ni el guardado tienen tiempo máximo; se queda en
   "Enviando..." o cargando mucho rato. Falta un timeout de pocos segundos y guardar en el celular.
2. **Riesgo serio:** la pantalla de cargar se guarda con el campo/usuario de la última vez que se abrió
   con señal. Si cambió de campo y abre sin señal, puede mostrar el campo anterior y cargar en el
   campo equivocado.
3. Pantallas nunca abiertas con señal en ese celular: sin señal sale "todavía no se guardó".
4. Catálogos viejos: sólo se actualizan al abrir el formulario con señal.
5. Cargas guardadas que fallan al subir (permisos, etc.) reintentan en silencio; no se ven los errores.
6. Pantallas de lectura (stock, historiales) sin señal muestran lo último visto, sin aviso.
7. Sesión vencida tras muchos días sin conexión; el login necesita señal.

Plan propuesto, en orden: (1) arreglar el campo guardado con la pantalla y poner tiempos máximos;
(2) bajar catálogos y guardar las pantallas de cargar apenas entra con señal; (3) mostrar las
cargas trabadas con su error y botón de reintento, y un "datos al día tal hora" en las pantallas de
lectura; (4) probar en modo avión y con señal muy mala (navegador y celular real). Para probar en el
navegador hace falta iniciar sesión (Claude no ingresa contraseñas: lo hace Tomas).

## API de solo lectura (`/api/v1`)

Para que otra web interna consulte el stock: `campos`, `productos`, `stock`, `movimientos`. Sólo GET,
con `Authorization: Bearer <clave>` (variable `API_KEY_LECTURA` en Vercel; `..._ANTERIOR` para rotar
sin cortar). Documentación completa en `docs/API.md`; código en `src/app/api/v1/` y
`src/lib/api-v1/`. El stock se devuelve por producto; el detalle por ubicación es opcional
(`?detalle=ubicacion`).

## Respaldo diario

`.github/workflows/respaldo-diario.yml` + `scripts/respaldo/` + `docs/respaldo.md` (leer ese
documento). Corre todos los días 03:00 (Argentina): `pg_dump` de `public` y `auth`, cifra con AES-256,
**restaura en una base vacía y compara filas**, y recién ahí sube a Google Drive y avisa por
Telegram ("COPIA DE SEGURIDAD OPERACIONES: ..."). Conserva 30 días. Funciona (verificado el
26/10/2026). Secrets en GitHub: `RESPALDO_DB_URL`, `RESPALDO_CLAVE`, `TELEGRAM_BOT_TOKEN`,
`TELEGRAM_CHAT_ID`, `GOOGLE_TOKEN`, `GOOGLE_CARPETA_ID`. La clave de cifrado la guarda Tomas en su
gestor de contraseñas; sin ella las copias no se abren. Ojo: rclone interpreta cualquier variable de
entorno `RCLONE_*` como opción propia (no usar ese prefijo para variables propias).

## Cosas a tener presentes

- **Datos de San Jorge con saldo negativo** (Limitador Tempo 70/30, Rollo de centeno): hay entregas
  sin entradas cargadas, o en otra unidad (tn vs kg). Es un problema de datos, no de código.
- Trabajo en Windows, con la carpeta dentro de OneDrive y con espacios en la ruta: entrecomillar
  las rutas. Para scripts largos, escribirlos a un archivo en vez de usar *heredocs* en la consola
  (fallan con ciertas comillas). Los avisos "LF will be replaced by CRLF" de git son normales.
- `AGENTS.md` lo regenera `next dev`; no editarlo a mano.
- Mensajes de commit en español, con el pie `Co-Authored-By` que indique la sesión.

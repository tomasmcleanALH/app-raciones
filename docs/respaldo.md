# Respaldo diario de la base de datos

Todos los días a las 03:00 (hora de Argentina) GitHub Actions saca una copia de la base de
Supabase y la guarda cifrada en Google Drive. También se puede correr a mano.

Archivos: `.github/workflows/respaldo-diario.yml` y `scripts/respaldo/`.

## Qué hace, en orden

1. Cuenta las filas de cada tabla del origen.
2. Copia los esquemas `public` (los datos de la app) y `auth` (usuarios y claves) con `pg_dump`.
3. Vuelve a contar las filas (la app sigue en uso mientras se copia).
4. Exporta los datos de `public` a un JSON legible (copia de emergencia que se abre sin Postgres).
5. Cifra los dos archivos con AES-256 usando `RESPALDO_CLAVE`.
6. **Prueba la restauración:** descifra el archivo, lo restaura en una base vacía y comprueba que
   estén todas las tablas y que la cantidad de filas coincida con el origen.
7. Sólo si la prueba dio bien, sube los dos archivos a Drive y comprueba que quedaron con el tamaño correcto.
8. Borra de la carpeta las copias de más de 30 días (sólo archivos que empiezan con `respaldo-operaciones-`).
9. Avisa por Telegram: ✅ si salió todo bien, ❌ con el link a la corrida si algo falló.

Cada día se generan dos archivos en Drive:

- `respaldo-operaciones-AAAA-MM-DD_HHMM.dump.enc`: la base completa (`public` + `auth`).
- `respaldo-operaciones-AAAA-MM-DD_HHMM-datos.json.enc`: sólo los datos de `public`, en JSON.

## Qué NO incluye

- Código de la app (está en GitHub).
- Archivos de Supabase Storage (la app no usa Storage).
- Otros esquemas de Supabase (`storage`, `vault`, etc.): sólo se copian `public` y `auth`.

## Armado inicial (una sola vez)

Lo que sigue lo hace una persona, porque implica claves y cuentas:

1. **Bot de Telegram:** hablar con `@BotFather`, `/newbot` y guardar el token. Escribirle "hola" al
   bot y averiguar el número de chat (`https://api.telegram.org/bot<TOKEN>/getUpdates`, campo
   `chat.id`). El token no se pega en ningún chat ni archivo.
2. **Carpeta de Drive** para las copias. El identificador es lo que va después de `/folders/` en el link.
3. **rclone:** bajarlo de `rclone.org` y correr `rclone authorize "drive"`. Se abre el navegador, se
   entra con la cuenta de Google y se acepta; el resultado (un texto con llaves `{...}`) es el
   `GOOGLE_TOKEN`.
4. **Secrets en GitHub** (Settings → Secrets and variables → Actions → New repository secret):

| Secret | Qué es |
|---|---|
| `RESPALDO_DB_URL` | Dirección del pooler de Supabase en **modo sesión (puerto 5432)**, con la contraseña de la base. Formato: `postgresql://postgres.<codigo-del-proyecto>:<contraseña>@<host-del-pooler>:5432/postgres`. Si la contraseña tiene símbolos (`@`, `#`, `/`…), hay que escribirlos codificados (`@` → `%40`). Se copia desde Supabase → Connect. |
| `RESPALDO_CLAVE` | Contraseña de cifrado, inventada. **Guardarla también en un gestor de contraseñas: sin ella las copias no se pueden abrir.** |
| `TELEGRAM_BOT_TOKEN` | Token del bot. |
| `TELEGRAM_CHAT_ID` | Número de chat. |
| `GOOGLE_TOKEN` | El resultado de `rclone authorize "drive"`. |
| `GOOGLE_CARPETA_ID` | Identificador de la carpeta de Drive. |

5. **Probar:** Actions → Respaldo diario → Run workflow. Tiene que terminar en verde, con el mensaje
   "Restauración verificada" en Telegram y dos archivos nuevos en Drive.

La tarea escribe en la cuenta de Google que autorizó el token.

## Cómo restaurar una copia

1. Bajar de Drive el archivo `...dump.enc`.
2. Descifrarlo (pide la clave `RESPALDO_CLAVE`):

```bash
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -in respaldo-operaciones-FECHA.dump.enc -out base.dump
```

3. Restaurar en una base nueva (necesita las herramientas de PostgreSQL 17):

```bash
pg_restore --no-owner --no-privileges --dbname "postgresql://..." base.dump
```

En un proyecto nuevo de Supabase, restaurar sólo lo necesario: los datos de `public` y, si hace
falta, los usuarios de `auth.users` / `auth.identities`. Si algo del esquema `auth` choca con lo que
ya trae el proyecto, se puede restaurar sólo `public` con `--schema=public`.

El archivo `...-datos.json.enc` se descifra igual (cambiando los nombres) y da un JSON con todas las
tablas, útil para recuperar datos puntuales sin armar una base.

## Si falla

Llega un ❌ por Telegram con el link a la corrida. Causas probables:

- **"Falta el secret ..."**: falta cargar o está mal escrito el nombre del secret.
- **Falla `pg_dump` / conexión**: revisar `RESPALDO_DB_URL` (modo sesión, puerto 5432, contraseña codificada).
- **Falla la restauración de prueba**: es lo que esta tarea justamente quiere detectar; no se sube nada nuevo a Drive. Revisar el error en el log.
- **Falla la subida a Drive**: el token de Google pudo haberse revocado; repetir `rclone authorize "drive"` y actualizar `GOOGLE_TOKEN`.

Una vez por mes conviene bajar una copia de Drive y probar restaurarla a mano.

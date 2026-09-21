# API de solo lectura de Operaciones

API para que otra web interna de Las Helenas consulte el stock de Operaciones (módulos **Alimentos** y **Materiales**). Es **solo lectura**: no se puede crear, modificar ni borrar nada desde acá. Está pensada para ser consultada desde un **servidor** (no desde un navegador), por eso no habilita CORS.

- **Dirección base:** `https://app-operaciones.vercel.app/api/v1`
- **Formato:** JSON (UTF-8).
- **Solo `GET`.** Cualquier otro método devuelve `405`.
- **Solo https.** Un pedido que no llegue por https se rechaza.

## Autenticación

Todos los pedidos llevan la clave secreta en el encabezado `Authorization`:

```
Authorization: Bearer <CLAVE>
```

La clave se guarda en las variables de entorno de Vercel de la app de Operaciones (`API_KEY_LECTURA`) y en las de la otra web. **Nunca** va en el código ni en GitHub.

**Cambiar la clave sin cortar el servicio:**

1. En Vercel (Operaciones), pasar el valor vigente a `API_KEY_LECTURA_ANTERIOR` y poner la clave nueva en `API_KEY_LECTURA`. Redeploy.
2. Actualizar la clave en la otra web.
3. Borrar `API_KEY_LECTURA_ANTERIOR`. Redeploy.

Ejemplo de pedido (en un servidor):

```bash
curl -H "Authorization: Bearer $CLAVE" \
  "https://app-operaciones.vercel.app/api/v1/stock?campo=san-jorge"
```

## Convenciones

- **Campos:** cada registro indica el campo con un código fijo: `san-jorge`, `san-jose`, `el-nene`, `las-isletas`, `santa-teresita`. Hoy existen cargados San Jorge y Las Isletas; los demás aparecen cuando se carguen en la app. Si un campo no tiene código válido, el valor es `null`.
- **Módulos:** `alimentos` o `materiales`.
- **Fechas y horas:** `fecha` es solo fecha (`2026-09-21`); el movimiento no guarda hora. `creado_en`, `actualizado_en` y `anulado_en` son timestamps ISO 8601 en UTC con milisegundos (`2026-09-21T05:00:00.000Z`).
- **Números:** cantidades como número (hasta 2 decimales). Pueden ser negativas en `stock` si se entregó más de lo cargado.
- **Stock:** no se guarda, se calcula como entradas menos salidas (en Alimentos, una salida es una entrega). Se calcula por producto y por unidad.
- **Errores:** siempre con este formato y el código HTTP correspondiente:

```json
{ "error": { "codigo": "clave_invalida", "mensaje": "La clave no es válida." } }
```

| HTTP | `codigo` | Cuándo |
|---|---|---|
| 400 | `parametro_invalido` | Un parámetro de la URL tiene un valor no permitido. |
| 400 | `https_requerido` | El pedido no llegó por https. |
| 401 | `no_autorizado` | Falta el encabezado `Authorization`. |
| 401 | `clave_invalida` | La clave no es correcta. |
| 405 | `metodo_no_permitido` | Se usó un método distinto de `GET`. |
| 500 | `error_interno` | Falla del servidor. Reintentar más tarde. |
| 503 | `api_no_configurada` | La API no tiene clave configurada en el servidor. |

---

## `GET /campos`

Lista los campos que tienen código.

```json
{
  "datos": [
    { "codigo": "las-isletas", "nombre": "Las Isletas", "activo": true },
    { "codigo": "san-jorge", "nombre": "San Jorge", "activo": true }
  ]
}
```

| Campo | Descripción |
|---|---|
| `codigo` | Código fijo del campo. Usar este para identificarlo. |
| `nombre` | Nombre como se ve en la app (puede cambiar; el código no). |
| `activo` | `false` si el campo está desactivado en la app. |

## `GET /productos`

Catálogo de productos: alimentos e insumos (módulo `alimentos`) y materiales (módulo `materiales`). Es la lista completa: **un producto que deja de aparecer fue borrado**. Los desactivados siguen apareciendo con `activo: false`.

Parámetros (todos opcionales): `campo`, `modulo`.

```json
{
  "datos": [
    {
      "id": "6f1c0a52-3a0e-4c55-9a1d-0b7d6a2b1c11",
      "modulo": "alimentos",
      "nombre": "Rollo de Alfalfa",
      "rubro": "Rollos",
      "unidades": ["unidades"],
      "activo": true,
      "campo": "san-jorge"
    }
  ]
}
```

| Campo | Descripción |
|---|---|
| `id` | Identificador del producto (uuid). |
| `modulo` | `alimentos` o `materiales`. |
| `nombre` | Nombre del producto. |
| `rubro` | Categoría del producto en la app, o `null` si no tiene. |
| `unidades` | Unidades en las que tiene movimientos (`kg`, `tn`, `bolsas`, `unidades`…). El producto en sí no tiene una unidad fija: la unidad se define en cada movimiento. Vacío si nunca tuvo movimientos. |
| `activo` | `false` si está desactivado en la app. |
| `campo` | Código del campo al que pertenece. |

## `GET /stock`

Stock actual. Una fila por producto y unidad (solo aparecen los que tienen movimientos).

Parámetros (todos opcionales): `campo`, `modulo`, `producto_id`, `detalle=ubicacion` (en Alimentos, desglosa el stock por ubicación de guardado; sin este parámetro se devuelve el total del producto).

```json
{
  "datos": [
    {
      "modulo": "alimentos",
      "campo": "san-jorge",
      "producto_id": "6f1c0a52-3a0e-4c55-9a1d-0b7d6a2b1c11",
      "producto": "Rollo de Alfalfa",
      "rubro": "Rollos",
      "activo": true,
      "unidad": "unidades",
      "cantidad": 1223,
      "actualizado_en": "2026-09-18T14:32:10.512Z"
    }
  ]
}
```

| Campo | Descripción |
|---|---|
| `modulo`, `campo`, `producto_id`, `producto`, `rubro`, `activo` | Igual que en `/productos`. |
| `unidad` | Unidad de la cantidad. |
| `cantidad` | Stock actual (entradas menos salidas). |
| `actualizado_en` | Momento del último movimiento (carga, edición o borrado) que afectó a este stock. |
| `ubicacion_id`, `ubicacion` | Solo con `detalle=ubicacion`. `null` para movimientos sin ubicación y para Materiales. |

## `GET /movimientos`

Entradas y salidas, incluidos los **anulados**. Pensado para sincronizar: pedir solo lo que cambió desde la última vez.

Parámetros (todos opcionales):

| Parámetro | Descripción |
|---|---|
| `cambiados_desde` | Fecha y hora ISO (ej. `2026-09-21T05:00:00Z`). Trae los movimientos creados, editados o anulados desde ese momento (inclusive). |
| `campo`, `modulo` | Filtros, igual que en las otras rutas. |
| `tipo` | `entrada` o `salida`. |
| `limit` | Registros por página. Por defecto 500, máximo 1000. |
| `cursor` | Para pedir la página siguiente: el `siguiente_cursor` de la respuesta anterior. |

Los resultados vienen ordenados por `actualizado_en` (para los anulados, `anulado_en`) de más viejo a más nuevo.

```json
{
  "datos": [
    {
      "id": "b1a4f7e0-9d6b-4d0c-8f52-2f3a5c1e7a90",
      "modulo": "alimentos",
      "tipo": "salida",
      "fecha": "2026-09-18",
      "producto_id": "6f1c0a52-3a0e-4c55-9a1d-0b7d6a2b1c11",
      "producto": "Rollo de Alfalfa",
      "cantidad": 5,
      "unidad": "unidades",
      "campo": "san-jorge",
      "creado_en": "2026-09-18T14:32:10.512Z",
      "actualizado_en": "2026-09-18T14:32:10.512Z",
      "anulado": false,
      "anulado_en": null
    }
  ],
  "siguiente_cursor": null
}
```

| Campo | Descripción |
|---|---|
| `id` | Identificador del movimiento (uuid). Es estable: si el movimiento se edita, vuelve con el mismo `id`. |
| `modulo` | `alimentos` o `materiales`. |
| `tipo` | `entrada` o `salida`. |
| `fecha` | Fecha del movimiento (sin hora). |
| `producto_id`, `producto` | Producto (ver `/productos`). |
| `cantidad` | Cantidad, siempre positiva; el signo lo da `tipo`. |
| `unidad` | Unidad de la cantidad. |
| `campo` | Código del campo. |
| `creado_en` | Cuándo se cargó. |
| `actualizado_en` | Última vez que se modificó (igual a `creado_en` si nunca se editó). |
| `anulado` | `true` si el movimiento fue borrado en la app. Los demás datos son los que tenía al borrarse. |
| `anulado_en` | Cuándo se borró; `null` si no está anulado. |
| `siguiente_cursor` | `null` si no hay más páginas; si no, pasarlo como `cursor` para seguir. |

**Cómo sincronizar cada noche:**

1. Guardar el momento en que empieza la sincronización (`T`).
2. Pedir `/movimientos?cambiados_desde=<última T guardada>`, y repetir con `cursor=<siguiente_cursor>` hasta que sea `null`.
3. Por cada registro, hacer *upsert* por `id`; si viene `anulado: true`, marcarlo como anulado o borrarlo en la otra base.
4. Guardar `T` como la nueva "última sincronización" solo si terminó bien.

`cambiados_desde` es inclusivo, así que puede repetirse algún registro del borde: por eso conviene el *upsert* por `id`. El primer pedido, sin `cambiados_desde`, trae todo el historial.

**Límite:** los borrados anteriores al 21/09/2026 (puesta en marcha de la API) no quedaron registrados y no se pueden informar. Para verificar de todas formas, `/productos` es siempre la lista completa.

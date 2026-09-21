import { CODIGOS_CAMPO, MODULOS, listarStock } from "@/lib/api-v1/datos";
import { endpointGet, noPermitido, paramEnum, paramUuid } from "@/lib/api-v1/http";

export const dynamic = "force-dynamic";

export const GET = endpointGet(async (url) =>
  listarStock({
    modulo: paramEnum(url, "modulo", MODULOS),
    campo: paramEnum(url, "campo", CODIGOS_CAMPO),
    productoId: paramUuid(url, "producto_id"),
    detalleUbicacion: paramEnum(url, "detalle", ["ubicacion"] as const) === "ubicacion",
  }),
);
export const POST = noPermitido;
export const PUT = noPermitido;
export const PATCH = noPermitido;
export const DELETE = noPermitido;

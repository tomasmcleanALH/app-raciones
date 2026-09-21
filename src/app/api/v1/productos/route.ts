import { CODIGOS_CAMPO, MODULOS, listarProductos } from "@/lib/api-v1/datos";
import { endpointGet, noPermitido, paramEnum } from "@/lib/api-v1/http";

export const dynamic = "force-dynamic";

export const GET = endpointGet(async (url) =>
  listarProductos({
    modulo: paramEnum(url, "modulo", MODULOS),
    campo: paramEnum(url, "campo", CODIGOS_CAMPO),
  }),
);
export const POST = noPermitido;
export const PUT = noPermitido;
export const PATCH = noPermitido;
export const DELETE = noPermitido;

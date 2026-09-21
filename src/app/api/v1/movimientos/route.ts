import { CODIGOS_CAMPO, MODULOS, listarMovimientos } from "@/lib/api-v1/datos";
import { endpointGet, noPermitido, paramEnum, paramFechaHora, paramLimite } from "@/lib/api-v1/http";

export const dynamic = "force-dynamic";

export const GET = endpointGet(async (url) =>
  listarMovimientos({
    modulo: paramEnum(url, "modulo", MODULOS),
    campo: paramEnum(url, "campo", CODIGOS_CAMPO),
    tipo: paramEnum(url, "tipo", ["entrada", "salida"] as const),
    cambiadosDesde: paramFechaHora(url, "cambiados_desde"),
    limite: paramLimite(url),
    cursor: url.searchParams.get("cursor") || null,
  }),
);
export const POST = noPermitido;
export const PUT = noPermitido;
export const PATCH = noPermitido;
export const DELETE = noPermitido;

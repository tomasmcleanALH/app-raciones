import { listarCampos } from "@/lib/api-v1/datos";
import { endpointGet, noPermitido } from "@/lib/api-v1/http";

export const dynamic = "force-dynamic";

export const GET = endpointGet(async () => listarCampos());
export const POST = noPermitido;
export const PUT = noPermitido;
export const PATCH = noPermitido;
export const DELETE = noPermitido;

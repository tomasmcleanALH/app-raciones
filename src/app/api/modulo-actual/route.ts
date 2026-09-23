import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { COOKIE_MODULO_ACTUAL } from "@/lib/modulos";

/** Guarda qué módulo eligió en la pantalla de tiles, para que el Nav sepa
 * cuál mostrar (y no todos los que tiene habilitados). */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { modulo } = await request.json();
  if (modulo !== "alimentos" && modulo !== "materiales") {
    return NextResponse.json({ error: "Módulo inválido" }, { status: 400 });
  }

  // httpOnly: false a propósito, igual que en /api/campo-actual: es sólo
  // una preferencia de UI que obtenerModuloActual() siempre revalida contra
  // los módulos reales del usuario, así que ElegirModuloTiles puede
  // guardarla igual desde el navegador si no hay señal para llegar acá.
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_MODULO_ACTUAL, modulo, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return NextResponse.json({ ok: true });
}

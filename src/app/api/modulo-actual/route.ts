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

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_MODULO_ACTUAL, modulo, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return NextResponse.json({ ok: true });
}

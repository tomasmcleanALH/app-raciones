import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { COOKIE_CAMPO_ACTUAL } from "@/lib/campo";

/** Cualquier usuario puede "cambiar de campo" entre los que le pertenecen
 * (el Dueño, entre todos; el resto, sólo entre los que se le asignaron). */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { campoId } = await request.json();
  if (!campoId) {
    return NextResponse.json({ error: "Falta campoId" }, { status: 400 });
  }

  const { data: profile } = await supabase.from("profiles").select("rol").eq("id", user.id).single();
  const esDueno = profile?.rol === "dueno";

  if (!esDueno) {
    const { data: pertenece } = await supabase
      .from("usuarios_campos")
      .select("campo_id")
      .eq("usuario_id", user.id)
      .eq("campo_id", campoId)
      .maybeSingle();
    if (!pertenece) {
      return NextResponse.json({ error: "No pertenecés a ese campo" }, { status: 403 });
    }
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_CAMPO_ACTUAL, campoId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return NextResponse.json({ ok: true });
}

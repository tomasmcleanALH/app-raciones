import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { COOKIE_CAMPO_ACTUAL } from "@/lib/campo";

/** Sólo el Dueño puede "cambiar de campo" (los demás roles tienen uno fijo). */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("rol").eq("id", user.id).single();
  if (!profile || profile.rol !== "dueno") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { campoId } = await request.json();
  if (!campoId) {
    return NextResponse.json({ error: "Falta campoId" }, { status: 400 });
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

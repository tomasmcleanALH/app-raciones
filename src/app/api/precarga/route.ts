import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { obtenerCampoActual } from "@/lib/campo";

/** Qué campos tiene el usuario: lo usa la precarga offline para bajar todo de cada uno. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("rol").eq("id", user.id).single();
  if (!profile) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { campos } = await obtenerCampoActual(user.id, profile.rol);
  return NextResponse.json(
    { userId: user.id, campos: campos.filter((c) => c.activo).map((c) => c.id) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

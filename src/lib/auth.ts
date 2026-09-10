import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/** Para usar en Server Components: trae el usuario logueado + su perfil, o redirige a /login. */
export async function requireProfile(): Promise<{ userId: string; email: string; profile: Profile }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    redirect("/login");
  }

  if (!(profile as Profile).activo) {
    await supabase.auth.signOut();
    redirect("/login?desactivado=1");
  }

  return { userId: user.id, email: user.email ?? "", profile: profile as Profile };
}

export async function requireEncargado() {
  const datos = await requireProfile();
  if (datos.profile.rol !== "encargado") {
    redirect("/");
  }
  return datos;
}

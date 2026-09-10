import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

const ROLES_VALIDOS = ["tractorista", "gerente", "encargado"];

async function verificarEncargado() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401 };

  const { data: profile } = await supabase.from("profiles").select("rol").eq("id", user.id).single();
  if (!profile || profile.rol !== "encargado") return { ok: false as const, status: 403 };

  return { ok: true as const, userId: user.id };
}

export async function POST(request: Request) {
  const chequeo = await verificarEncargado();
  if (!chequeo.ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: chequeo.status });
  }

  const { email, password, nombre, rol } = await request.json();

  if (!email || !password || !nombre || !rol) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 });
  }
  if (!ROLES_VALIDOS.includes(rol)) {
    return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre, rol },
  });

  if (error || !data.user) {
    return NextResponse.json({ error: error?.message ?? "No se pudo crear el usuario" }, { status: 400 });
  }

  // El trigger de la base ya crea el perfil, pero lo confirmamos/sobreescribimos acá
  // para asegurarnos de que nombre y rol queden exactamente como los cargó el encargado.
  await admin.from("profiles").upsert({ id: data.user.id, nombre, rol, activo: true });

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const chequeo = await verificarEncargado();
  if (!chequeo.ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: chequeo.status });
  }

  const { id, activo, rol } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "Falta id" }, { status: 400 });
  }

  const cambios: Record<string, unknown> = {};
  if (typeof activo === "boolean") cambios.activo = activo;
  if (ROLES_VALIDOS.includes(rol)) cambios.rol = rol;

  if (Object.keys(cambios).length === 0) {
    return NextResponse.json({ error: "Nada para actualizar" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update(cambios).eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const chequeo = await verificarEncargado();
  if (!chequeo.ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: chequeo.status });
  }

  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "Falta id" }, { status: 400 });
  }
  if (id === chequeo.userId) {
    return NextResponse.json({ error: "No podés borrar tu propio usuario" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Si el usuario ya cargó entregas, borrarlo rompería la referencia en "entregas"
  // (a propósito: así no se pierde el historial). En ese caso, avisamos y sugerimos desactivar.
  const { count } = await admin
    .from("entregas")
    .select("id", { count: "exact", head: true })
    .eq("cargado_por", id);

  if (count && count > 0) {
    return NextResponse.json(
      { error: `Este usuario ya cargó ${count} entrega(s). No se puede borrar sin perder ese historial: desactivalo en cambio.` },
      { status: 400 },
    );
  }

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

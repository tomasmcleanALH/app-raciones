import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { normalizarUsuarioAEmail } from "@/lib/usuario";

const ROLES_VALIDOS = ["tractorista", "gerente", "encargado", "dueno"];
const ROLES_QUE_ENCARGADO_PUEDE_ASIGNAR = ["tractorista", "gerente", "encargado"];
const MODULOS_VALIDOS = ["alimentos", "materiales"];
const MODULOS_POR_DEFECTO = ["alimentos"];

async function verificarPermiso() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401 };

  const { data: profile } = await supabase.from("profiles").select("rol").eq("id", user.id).single();
  if (!profile || (profile.rol !== "encargado" && profile.rol !== "dueno")) {
    return { ok: false as const, status: 403 };
  }

  const esDueno = profile.rol === "dueno";
  let campoId: string | null = null;

  if (!esDueno) {
    const { data: uc } = await supabase
      .from("usuarios_campos")
      .select("campo_id")
      .eq("usuario_id", user.id)
      .limit(1)
      .maybeSingle();
    campoId = uc?.campo_id ?? null;
  }

  return { ok: true as const, userId: user.id, esDueno, campoId };
}

/** Un encargado sólo puede tocar usuarios de su propio campo. */
async function perteneceAlCampo(admin: ReturnType<typeof createAdminClient>, usuarioId: string, campoId: string) {
  const { data } = await admin
    .from("usuarios_campos")
    .select("campo_id")
    .eq("usuario_id", usuarioId)
    .eq("campo_id", campoId)
    .maybeSingle();
  return !!data;
}

export async function POST(request: Request) {
  const chequeo = await verificarPermiso();
  if (!chequeo.ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: chequeo.status });
  }

  const { email, password, nombre, rol, campoId: campoIdBody, modulos: modulosBody } = await request.json();

  if (!email || !password || !nombre || !rol) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 });
  }
  if (!ROLES_VALIDOS.includes(rol)) {
    return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
  }
  if (!chequeo.esDueno && !ROLES_QUE_ENCARGADO_PUEDE_ASIGNAR.includes(rol)) {
    return NextResponse.json({ error: "No podés asignar ese rol" }, { status: 403 });
  }

  // Sólo el dueño puede elegir a qué módulo(s) tiene acceso; el resto queda
  // con Alimentos por defecto (el comportamiento de siempre).
  let modulos: string[] = MODULOS_POR_DEFECTO;
  if (chequeo.esDueno && rol !== "dueno" && modulosBody) {
    if (!Array.isArray(modulosBody) || modulosBody.length === 0 || !modulosBody.every((m: string) => MODULOS_VALIDOS.includes(m))) {
      return NextResponse.json({ error: "Elegí al menos un módulo válido" }, { status: 400 });
    }
    modulos = modulosBody;
  }

  // A qué campo queda asignado (no aplica si el nuevo usuario es Dueño).
  let campoId: string | null = null;
  if (rol !== "dueno") {
    campoId = chequeo.esDueno ? campoIdBody ?? null : chequeo.campoId;
    if (!campoId) {
      return NextResponse.json({ error: "Falta elegir el campo" }, { status: 400 });
    }
  }

  const admin = createAdminClient();
  const emailFinal = normalizarUsuarioAEmail(email);

  const { data, error } = await admin.auth.admin.createUser({
    email: emailFinal,
    password,
    email_confirm: true,
    user_metadata: { nombre, rol },
  });

  if (error || !data.user) {
    const yaExiste = error?.message?.toLowerCase().includes("already");
    return NextResponse.json(
      { error: yaExiste ? "Ya existe un usuario con ese nombre." : error?.message ?? "No se pudo crear el usuario" },
      { status: 400 },
    );
  }

  // El trigger de la base ya crea el perfil, pero lo confirmamos/sobreescribimos acá
  // para asegurarnos de que nombre y rol queden exactamente como los cargó el admin.
  await admin.from("profiles").upsert({ id: data.user.id, nombre, rol, activo: true });

  if (campoId) {
    await admin.from("usuarios_campos").insert({ usuario_id: data.user.id, campo_id: campoId });
  }

  if (rol !== "dueno") {
    await admin.from("usuarios_modulos").insert(modulos.map((modulo) => ({ usuario_id: data.user.id, modulo })));
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const chequeo = await verificarPermiso();
  if (!chequeo.ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: chequeo.status });
  }

  const { id, activo, rol, nombre, email, password, campoId: nuevoCampoId, modulos: modulosBody } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "Falta id" }, { status: 400 });
  }
  if (password && password.length < 6) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 });
  }
  if (rol && !ROLES_VALIDOS.includes(rol)) {
    return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
  }
  if (rol && !chequeo.esDueno && !ROLES_QUE_ENCARGADO_PUEDE_ASIGNAR.includes(rol)) {
    return NextResponse.json({ error: "No podés asignar ese rol" }, { status: 403 });
  }
  if (modulosBody !== undefined && !chequeo.esDueno) {
    return NextResponse.json({ error: "Sólo el Dueño puede cambiar los módulos" }, { status: 403 });
  }
  if (
    modulosBody !== undefined &&
    (!Array.isArray(modulosBody) || modulosBody.length === 0 || !modulosBody.every((m: string) => MODULOS_VALIDOS.includes(m)))
  ) {
    return NextResponse.json({ error: "Elegí al menos un módulo válido" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Un encargado sólo puede editar gente de su propio campo.
  if (!chequeo.esDueno) {
    if (!chequeo.campoId || !(await perteneceAlCampo(admin, id, chequeo.campoId))) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  // Cambio de usuario (login) y/o contraseña: se maneja aparte porque vive en auth, no en profiles.
  if (email || password) {
    const datosAuth: Record<string, unknown> = {};
    if (email) datosAuth.email = normalizarUsuarioAEmail(email);
    if (password) datosAuth.password = password;

    const { error: errorAuth } = await admin.auth.admin.updateUserById(id, datosAuth);
    if (errorAuth) {
      const yaExiste = errorAuth.message?.toLowerCase().includes("already");
      return NextResponse.json(
        { error: yaExiste ? "Ya existe un usuario con ese nombre." : errorAuth.message },
        { status: 400 },
      );
    }
  }

  const cambios: Record<string, unknown> = {};
  if (typeof activo === "boolean") cambios.activo = activo;
  if (rol) cambios.rol = rol;
  if (typeof nombre === "string" && nombre.trim()) cambios.nombre = nombre.trim();

  if (Object.keys(cambios).length === 0 && !email && !password && !nuevoCampoId) {
    return NextResponse.json({ error: "Nada para actualizar" }, { status: 400 });
  }

  if (Object.keys(cambios).length > 0) {
    const { error } = await admin.from("profiles").update(cambios).eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  // Sólo el dueño puede reasignar de campo (o quitarlo, si lo ascendió a Dueño).
  if (chequeo.esDueno && (nuevoCampoId || rol === "dueno")) {
    await admin.from("usuarios_campos").delete().eq("usuario_id", id);
    if (nuevoCampoId && rol !== "dueno") {
      await admin.from("usuarios_campos").insert({ usuario_id: id, campo_id: nuevoCampoId });
    }
  }

  // Sólo el dueño puede elegir a qué módulo(s) tiene acceso cada usuario.
  if (chequeo.esDueno && modulosBody) {
    await admin.from("usuarios_modulos").delete().eq("usuario_id", id);
    await admin.from("usuarios_modulos").insert(modulosBody.map((modulo: string) => ({ usuario_id: id, modulo })));
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const chequeo = await verificarPermiso();
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

  if (!chequeo.esDueno) {
    if (!chequeo.campoId || !(await perteneceAlCampo(admin, id, chequeo.campoId))) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  // Si el usuario ya cargó entregas o movimientos de stock, borrarlo rompería
  // esa referencia (a propósito: así no se pierde el historial). En ese caso,
  // avisamos y sugerimos desactivar.
  const [{ count: countEntregas }, { count: countMovimientos }] = await Promise.all([
    admin.from("entregas").select("id", { count: "exact", head: true }).eq("cargado_por", id),
    admin.from("movimientos_stock").select("id", { count: "exact", head: true }).eq("cargado_por", id),
  ]);

  if ((countEntregas && countEntregas > 0) || (countMovimientos && countMovimientos > 0)) {
    const partes = [];
    if (countEntregas) partes.push(`${countEntregas} entrega(s)`);
    if (countMovimientos) partes.push(`${countMovimientos} movimiento(s) de stock`);
    return NextResponse.json(
      { error: `Este usuario ya cargó ${partes.join(" y ")}. No se puede borrar sin perder ese historial: desactivalo en cambio.` },
      { status: 400 },
    );
  }

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

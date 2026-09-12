"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Campo, Profile, Rol } from "@/lib/types";

// Nombres internos (tractorista/encargado/gerente/dueno) sin cambios en el
// código y la base; esto sólo traduce lo que se muestra en pantalla.
const ETIQUETA_ROL: Record<Rol, string> = {
  tractorista: "Usuario",
  encargado: "Administrador",
  gerente: "Gerente",
  dueno: "Dueño",
};

const ROLES: Rol[] = ["tractorista", "gerente", "encargado", "dueno"];

interface Fila extends Profile {
  campo_nombre: string;
}

export default function UsuariosAdmin({
  miPropioId,
  esDueno,
  miCampoNombre,
}: {
  miPropioId: string;
  esDueno: boolean;
  miCampoNombre?: string;
}) {
  const [usuarios, setUsuarios] = useState<Fila[]>([]);
  const [campos, setCampos] = useState<Campo[]>([]);
  const [cargando, setCargando] = useState(true);

  // Roles que este admin puede asignar/mostrar en los selectores.
  const rolesAsignables = esDueno ? ROLES : ROLES.filter((r) => r !== "dueno");

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<Rol>("tractorista");
  const [campoIdForm, setCampoIdForm] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [menuAbierto, setMenuAbierto] = useState<string | null>(null);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState<string | null>(null);
  const [errorBorrado, setErrorBorrado] = useState<string | null>(null);
  const [borrando, setBorrando] = useState<string | null>(null);

  const [editando, setEditando] = useState<Fila | null>(null);
  const [nombreEdit, setNombreEdit] = useState("");
  const [usuarioEdit, setUsuarioEdit] = useState("");
  const [passwordEdit, setPasswordEdit] = useState("");
  const [rolEdit, setRolEdit] = useState<Rol>("tractorista");
  const [campoIdEdit, setCampoIdEdit] = useState("");
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [errorEdicion, setErrorEdicion] = useState<string | null>(null);

  async function recargar() {
    const supabase = createClient();
    const [{ data }, camposRes] = await Promise.all([
      supabase.from("profiles").select("*, usuarios_campos(campos(nombre))").order("nombre"),
      esDueno ? supabase.from("campos").select("*").order("nombre") : Promise.resolve({ data: null }),
    ]);

    const filas = ((data ?? []) as any[]).map((u) => ({
      ...u,
      campo_nombre: u.rol === "dueno" ? "Todos" : (u.usuarios_campos?.[0]?.campos?.nombre ?? "—"),
    })) as Fila[];
    setUsuarios(filas);
    if (camposRes.data) setCampos(camposRes.data as Campo[]);
    setCargando(false);
  }

  useEffect(() => {
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function crearUsuario(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);

    if (esDueno && rol !== "dueno" && !campoIdForm) {
      setError("Elegí a qué campo pertenece.");
      return;
    }

    setEnviando(true);
    const res = await fetch("/api/admin/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        nombre,
        rol,
        ...(esDueno && rol !== "dueno" ? { campoId: campoIdForm } : {}),
      }),
    });
    const data = await res.json();
    setEnviando(false);

    if (!res.ok) {
      setError(data.error ?? "Error al crear el usuario");
      return;
    }

    setOk(`Usuario "${nombre}" creado.`);
    setNombre("");
    setEmail("");
    setPassword("");
    setRol("tractorista");
    setCampoIdForm("");
    recargar();
  }

  async function cambiar(id: string, cambios: { activo?: boolean; rol?: Rol }) {
    await fetch("/api/admin/usuarios", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...cambios }),
    });
    recargar();
  }

  function abrirEdicion(u: Fila) {
    setMenuAbierto(null);
    setErrorEdicion(null);
    setEditando(u);
    setNombreEdit(u.nombre);
    setUsuarioEdit("");
    setPasswordEdit("");
    setRolEdit(u.rol);
    const campoActual = campos.find((c) => c.nombre === u.campo_nombre);
    setCampoIdEdit(campoActual?.id ?? "");
  }

  async function guardarEdicion(e: React.FormEvent) {
    e.preventDefault();
    if (!editando || !nombreEdit.trim()) return;
    if (esDueno && rolEdit !== "dueno" && !campoIdEdit) {
      setErrorEdicion("Elegí a qué campo pertenece.");
      return;
    }
    setGuardandoEdicion(true);
    setErrorEdicion(null);

    const res = await fetch("/api/admin/usuarios", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editando.id,
        nombre: nombreEdit.trim(),
        rol: rolEdit,
        ...(esDueno ? { campoId: rolEdit === "dueno" ? null : campoIdEdit } : {}),
        ...(usuarioEdit.trim() ? { email: usuarioEdit.trim() } : {}),
        ...(passwordEdit ? { password: passwordEdit } : {}),
      }),
    });
    const data = await res.json();
    setGuardandoEdicion(false);

    if (!res.ok) {
      setErrorEdicion(data.error ?? "No se pudo guardar");
      return;
    }

    setEditando(null);
    recargar();
  }

  async function borrar(id: string) {
    setErrorBorrado(null);
    setBorrando(id);
    const res = await fetch("/api/admin/usuarios", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    setBorrando(null);
    setConfirmandoBorrado(null);

    if (!res.ok) {
      setErrorBorrado(data.error ?? "No se pudo borrar el usuario");
      return;
    }
    recargar();
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-4 text-xl font-bold text-stone-900">Usuarios</h1>
      {!esDueno && miCampoNombre && (
        <p className="mb-4 text-sm text-stone-500">Campo: <span className="font-medium text-stone-700">{miCampoNombre}</span></p>
      )}

      <form onSubmit={crearUsuario} className="mb-6 space-y-3 rounded-xl bg-white p-5 shadow-sm ring-1 ring-stone-200">
        <h2 className="text-sm font-medium text-stone-700">Crear nuevo usuario</h2>
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre"
          required
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-base focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="text"
          placeholder="Usuario (nombre de usuario o email, opcional este último)"
          required
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-base focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="text"
          placeholder="Contraseña (mínimo 6 caracteres)"
          required
          minLength={6}
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-base focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
        />
        <select
          value={rol}
          onChange={(e) => setRol(e.target.value as Rol)}
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-base focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
        >
          {rolesAsignables.map((r) => (
            <option key={r} value={r}>{ETIQUETA_ROL[r]}</option>
          ))}
        </select>
        {esDueno && rol !== "dueno" && (
          <select
            value={campoIdForm}
            onChange={(e) => setCampoIdForm(e.target.value)}
            required
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-base focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
          >
            <option value="" disabled>¿A qué campo pertenece?</option>
            {campos.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        {ok && <p className="text-sm text-emerald-700">{ok}</p>}

        <button
          type="submit"
          disabled={enviando}
          className="w-full rounded-lg bg-brand-700 px-4 py-2.5 font-medium text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {enviando ? "Creando..." : "Crear usuario"}
        </button>
      </form>

      {errorBorrado && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{errorBorrado}</p>}

      <div className="overflow-visible rounded-xl bg-white shadow-sm ring-1 ring-stone-200">
        {cargando ? (
          <p className="p-4 text-sm text-stone-400">Cargando...</p>
        ) : (
          <ul>
            {usuarios.map((u) => (
              <li key={u.id} className="border-b border-stone-100 px-4 py-3.5 last:border-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`truncate font-medium ${u.activo ? "text-stone-900" : "text-stone-400 line-through"}`}>
                      {u.nombre}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">{ETIQUETA_ROL[u.rol]}</span>
                      {esDueno && (
                        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700">{u.campo_nombre}</span>
                      )}
                    </div>
                  </div>
                  {u.id !== miPropioId && (
                    <div className="flex shrink-0 items-center gap-2">
                      {u.rol !== "dueno" && (
                        <select
                          value={u.rol}
                          onChange={(e) => cambiar(u.id, { rol: e.target.value as Rol })}
                          className="rounded-full border border-stone-200 bg-stone-100 px-2 py-1 text-xs font-medium text-stone-600 hover:bg-stone-200"
                        >
                          {rolesAsignables.filter((r) => r !== "dueno").map((r) => (
                            <option key={r} value={r}>{ETIQUETA_ROL[r]}</option>
                          ))}
                        </select>
                      )}

                      <div className="relative">
                        <button
                          onClick={() => {
                            setConfirmandoBorrado(null);
                            setMenuAbierto(menuAbierto === u.id ? null : u.id);
                          }}
                          className="rounded px-2 py-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                          aria-label="Más acciones"
                        >
                          ⋮
                        </button>

                        {menuAbierto === u.id && (
                          <>
                            <button
                              className="fixed inset-0 z-10 cursor-default"
                              onClick={() => setMenuAbierto(null)}
                              aria-label="Cerrar menú"
                            />
                            <div className="absolute right-0 top-full z-20 w-44 rounded-lg bg-white py-1 text-left shadow-lg ring-1 ring-stone-200">
                              {confirmandoBorrado === u.id ? (
                                <div className="px-3 py-2">
                                  <p className="mb-2 text-xs text-stone-600">¿Borrar para siempre?</p>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => setConfirmandoBorrado(null)}
                                      className="flex-1 rounded bg-stone-100 px-2 py-1 text-xs hover:bg-stone-200"
                                    >
                                      No
                                    </button>
                                    <button
                                      onClick={() => borrar(u.id)}
                                      disabled={borrando === u.id}
                                      className="flex-1 rounded bg-red-700 px-2 py-1 text-xs text-white hover:bg-red-800 disabled:opacity-60"
                                    >
                                      {borrando === u.id ? "..." : "Sí"}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <button
                                    onClick={() => abrirEdicion(u)}
                                    className="block w-full px-3 py-2 text-left text-sm text-stone-700 hover:bg-stone-50"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    onClick={() => {
                                      setMenuAbierto(null);
                                      cambiar(u.id, { activo: !u.activo });
                                    }}
                                    className="block w-full px-3 py-2 text-left text-sm text-stone-700 hover:bg-stone-50"
                                  >
                                    {u.activo ? "Desactivar" : "Activar"}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setErrorBorrado(null);
                                      setConfirmandoBorrado(u.id);
                                    }}
                                    className="block w-full px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
                                  >
                                    Borrar
                                  </button>
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-2 text-xs text-stone-400">
        Desactivar bloquea el acceso sin borrar el historial. Borrar es permanente y sólo se puede
        hacer si ese usuario todavía no cargó ninguna entrega.
      </p>

      {editando && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
          <form
            onSubmit={guardarEdicion}
            className="w-full max-w-sm space-y-4 rounded-xl bg-white p-5 shadow-xl"
          >
            <h2 className="text-lg font-bold text-stone-900">Editar usuario</h2>

            <div>
              <label className="block text-sm font-medium text-stone-700">Nombre</label>
              <input
                value={nombreEdit}
                onChange={(e) => setNombreEdit(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-base focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700">Rol</label>
              <select
                value={rolEdit}
                onChange={(e) => setRolEdit(e.target.value as Rol)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-base focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
              >
                {rolesAsignables.map((r) => (
                  <option key={r} value={r}>{ETIQUETA_ROL[r]}</option>
                ))}
              </select>
            </div>

            {esDueno && rolEdit !== "dueno" && (
              <div>
                <label className="block text-sm font-medium text-stone-700">Campo</label>
                <select
                  value={campoIdEdit}
                  onChange={(e) => setCampoIdEdit(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-base focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
                >
                  <option value="" disabled>Elegir...</option>
                  {campos.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-stone-700">Cambiar usuario (login)</label>
              <input
                value={usuarioEdit}
                onChange={(e) => setUsuarioEdit(e.target.value)}
                placeholder="Dejar en blanco para no cambiarlo"
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-base focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700">Nueva contraseña</label>
              <input
                value={passwordEdit}
                onChange={(e) => setPasswordEdit(e.target.value)}
                placeholder="Dejar en blanco para no cambiarla"
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-base focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
              />
            </div>

            {errorEdicion && <p className="text-sm text-red-600">{errorEdicion}</p>}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setEditando(null)}
                disabled={guardandoEdicion}
                className="flex-1 rounded-lg border border-stone-300 px-4 py-2.5 font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardandoEdicion}
                className="flex-1 rounded-lg bg-brand-700 px-4 py-2.5 font-medium text-white hover:bg-brand-800 disabled:opacity-60"
              >
                {guardandoEdicion ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

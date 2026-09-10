"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Rol } from "@/lib/types";

// Nombres internos ("tractorista" / "encargado") sin cambios en el código y la base;
// esto sólo traduce lo que se muestra en pantalla.
const ETIQUETA_ROL: Record<Rol, string> = {
  tractorista: "Usuario",
  encargado: "Administrador",
  gerente: "Gerente",
};

const ROLES: Rol[] = ["tractorista", "gerente", "encargado"];

export default function UsuariosAdmin({ miPropioId }: { miPropioId: string }) {
  const [usuarios, setUsuarios] = useState<Profile[]>([]);
  const [cargando, setCargando] = useState(true);

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<Rol>("tractorista");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [confirmandoBorrado, setConfirmandoBorrado] = useState<string | null>(null);
  const [errorBorrado, setErrorBorrado] = useState<string | null>(null);
  const [borrando, setBorrando] = useState<string | null>(null);

  async function recargar() {
    const supabase = createClient();
    const { data } = await supabase.from("profiles").select("*").order("nombre");
    setUsuarios((data ?? []) as Profile[]);
    setCargando(false);
  }

  useEffect(() => {
    recargar();
  }, []);

  async function crearUsuario(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    setEnviando(true);

    const res = await fetch("/api/admin/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, nombre, rol }),
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
          type="email"
          placeholder="Usuario (email)"
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
          {ROLES.map((r) => (
            <option key={r} value={r}>{ETIQUETA_ROL[r]}</option>
          ))}
        </select>

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

      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-stone-200">
        {cargando ? (
          <p className="p-4 text-sm text-stone-400">Cargando...</p>
        ) : (
          <ul>
            {usuarios.map((u) => (
              <li key={u.id} className="border-b border-stone-100 px-4 py-3 last:border-0">
                <div className="flex items-center justify-between">
                  <div>
                    <span className={u.activo ? "" : "text-stone-400 line-through"}>{u.nombre}</span>
                    <span className="ml-2 rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">{ETIQUETA_ROL[u.rol]}</span>
                  </div>
                  {u.id !== miPropioId && confirmandoBorrado !== u.id && (
                    <div className="flex items-center gap-2">
                      <select
                        value={u.rol}
                        onChange={(e) => cambiar(u.id, { rol: e.target.value as Rol })}
                        className="rounded-full border border-stone-200 bg-stone-100 px-2 py-1 text-xs font-medium text-stone-600 hover:bg-stone-200"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>{ETIQUETA_ROL[r]}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => cambiar(u.id, { activo: !u.activo })}
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          u.activo ? "bg-stone-100 text-stone-600 hover:bg-stone-200" : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {u.activo ? "Desactivar" : "Activar"}
                      </button>
                      <button
                        onClick={() => {
                          setErrorBorrado(null);
                          setConfirmandoBorrado(u.id);
                        }}
                        className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                      >
                        Borrar
                      </button>
                    </div>
                  )}
                </div>

                {confirmandoBorrado === u.id && (
                  <div className="mt-2 flex items-center justify-between rounded-lg bg-red-50 px-3 py-2">
                    <span className="text-xs text-red-800">
                      ¿Borrar a &quot;{u.nombre}&quot; para siempre? No se puede deshacer.
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setConfirmandoBorrado(null)}
                        className="rounded-full bg-white px-3 py-1 text-xs font-medium text-stone-600 hover:bg-stone-100"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => borrar(u.id)}
                        disabled={borrando === u.id}
                        className="rounded-full bg-red-700 px-3 py-1 text-xs font-medium text-white hover:bg-red-800 disabled:opacity-60"
                      >
                        {borrando === u.id ? "Borrando..." : "Sí, borrar"}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-2 text-xs text-stone-400">
        Desactivar bloquea el acceso sin borrar el historial. Borrar es permanente y sólo se puede
        hacer si ese usuario todavía no cargó ninguna entrega.
      </p>
    </div>
  );
}

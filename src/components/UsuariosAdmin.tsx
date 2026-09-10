"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

export default function UsuariosAdmin({ miPropioId }: { miPropioId: string }) {
  const [usuarios, setUsuarios] = useState<Profile[]>([]);
  const [cargando, setCargando] = useState(true);

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<"tractorista" | "encargado">("tractorista");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

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

  async function cambiar(id: string, cambios: { activo?: boolean; rol?: "tractorista" | "encargado" }) {
    await fetch("/api/admin/usuarios", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...cambios }),
    });
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
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-base focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="Usuario (email)"
          required
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-base focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="text"
          placeholder="Contraseña (mínimo 6 caracteres)"
          required
          minLength={6}
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-base focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
        />
        <select
          value={rol}
          onChange={(e) => setRol(e.target.value as "tractorista" | "encargado")}
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-base focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
        >
          <option value="tractorista">Tractorista</option>
          <option value="encargado">Encargado</option>
        </select>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {ok && <p className="text-sm text-emerald-700">{ok}</p>}

        <button
          type="submit"
          disabled={enviando}
          className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {enviando ? "Creando..." : "Crear usuario"}
        </button>
      </form>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-stone-200">
        {cargando ? (
          <p className="p-4 text-sm text-stone-400">Cargando...</p>
        ) : (
          <ul>
            {usuarios.map((u) => (
              <li key={u.id} className="flex items-center justify-between border-b border-stone-100 px-4 py-3 last:border-0">
                <div>
                  <span className={u.activo ? "" : "text-stone-400 line-through"}>{u.nombre}</span>
                  <span className="ml-2 rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">{u.rol}</span>
                </div>
                <div className="flex gap-2">
                  {u.id !== miPropioId && (
                    <>
                      <button
                        onClick={() => cambiar(u.id, { rol: u.rol === "encargado" ? "tractorista" : "encargado" })}
                        className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600 hover:bg-stone-200"
                      >
                        Hacer {u.rol === "encargado" ? "tractorista" : "encargado"}
                      </button>
                      <button
                        onClick={() => cambiar(u.id, { activo: !u.activo })}
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          u.activo ? "bg-stone-100 text-stone-600 hover:bg-stone-200" : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {u.activo ? "Desactivar" : "Activar"}
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-2 text-xs text-stone-400">
        Desactivar un usuario le bloquea el acceso a la app, pero no borra sus entregas ya cargadas.
      </p>
    </div>
  );
}

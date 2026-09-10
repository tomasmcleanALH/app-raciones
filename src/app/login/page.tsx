"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    searchParams.get("desactivado") ? "Tu usuario está desactivado. Hablá con el administrador." : null,
  );
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError("Necesitás señal / wifi para iniciar sesión la primera vez.");
      return;
    }

    setCargando(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setCargando(false);

    if (error) {
      setError("Usuario o contraseña incorrectos.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-stone-900">Operaciones</h1>
          <p className="mt-1 text-sm text-stone-500">Entregas de alimento a las recrías</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-stone-700">
              Usuario
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-stone-700">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={cargando}
            className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-base font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            {cargando ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-stone-400">
          ¿No tenés cuenta? Pedile al administrador que te la cree.
        </p>
      </div>
    </div>
  );
}

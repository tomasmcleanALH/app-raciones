import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente de Supabase para usar en componentes del navegador ("use client").
 * La sesión se guarda en localStorage, por eso funciona aunque se pierda
 * la señal: el login queda recordado, sólo fallan los pedidos de red.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

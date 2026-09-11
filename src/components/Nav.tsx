"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Campo, Rol } from "@/lib/types";
import CampoSelector from "./CampoSelector";
import SyncStatusBadge from "./SyncStatusBadge";

export default function Nav({
  nombre,
  rol,
  campo,
  campos,
}: {
  nombre: string;
  rol: Rol;
  campo: Campo | null;
  campos: Campo[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuAbierto, setMenuAbierto] = useState(false);

  const veTodo = rol === "encargado" || rol === "gerente" || rol === "dueno";

  const links = veTodo
    ? [
        { href: "/", label: "Grilla" },
        { href: "/entregar", label: "Cargar entrega" },
        { href: "/admin/lotes", label: "Lotes" },
        { href: "/admin/alimentos", label: "Alimentos" },
        ...(rol === "encargado" || rol === "dueno" ? [{ href: "/admin/usuarios", label: "Usuarios" }] : []),
        ...(rol === "dueno" ? [{ href: "/admin/campos", label: "Campos" }] : []),
      ]
    : [{ href: "/", label: "Cargar entrega" }];

  // Si cambia de página (se tocó un link), cerrar el menú de celular.
  useEffect(() => {
    setMenuAbierto(false);
  }, [pathname]);

  async function salir() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const logo = (
    <span className="flex items-center gap-2 font-bold text-brand-800">
      <img src="/logo-las-helenas.jpg" alt="" className="h-7 w-7 rounded-md object-cover" />
      Operaciones
    </span>
  );

  const selectorCampo =
    rol === "dueno" ? (
      campos.length > 0 && campo ? <CampoSelector campos={campos} campoActualId={campo.id} /> : null
    ) : campo ? (
      <span className="rounded-lg bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">{campo.nombre}</span>
    ) : null;

  return (
    <header className="relative border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        {/* Botón hamburguesa: sólo en celular */}
        <button
          onClick={() => setMenuAbierto((v) => !v)}
          className="rounded-md p-1.5 text-stone-600 hover:bg-stone-100 md:hidden"
          aria-label="Abrir menú"
          aria-expanded={menuAbierto}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {logo}

        <div className="hidden md:block">{selectorCampo}</div>

        {/* Nav horizontal: sólo en pantallas medianas/grandes */}
        <nav className="hidden flex-1 flex-wrap gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                pathname === link.href
                  ? "bg-brand-100 text-brand-800"
                  : "text-stone-600 hover:bg-stone-100"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3 md:ml-0">
          <SyncStatusBadge />
          <div className="hidden items-center gap-2 text-sm text-stone-500 md:flex">
            <span>{nombre}</span>
            <button onClick={salir} className="text-stone-400 hover:text-stone-700" title="Cerrar sesión">
              Salir
            </button>
          </div>
        </div>
      </div>

      {/* Menú desplegable de celular */}
      {menuAbierto && (
        <>
          <button
            className="fixed inset-0 z-20 cursor-default bg-black/20 md:hidden"
            onClick={() => setMenuAbierto(false)}
            aria-label="Cerrar menú"
          />
          <div className="absolute inset-x-0 top-full z-30 border-b border-stone-200 bg-white shadow-lg md:hidden">
            {selectorCampo && <div className="border-b border-stone-100 px-4 py-3">{selectorCampo}</div>}
            <nav className="flex flex-col p-2">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-md px-4 py-3 text-base font-medium ${
                    pathname === link.href
                      ? "bg-brand-100 text-brand-800"
                      : "text-stone-700 hover:bg-stone-50"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center justify-between border-t border-stone-100 px-4 py-3 text-sm text-stone-500">
              <span>{nombre}</span>
              <button onClick={salir} className="font-medium text-stone-600 hover:text-stone-900">
                Cerrar sesión
              </button>
            </div>
          </div>
        </>
      )}
    </header>
  );
}

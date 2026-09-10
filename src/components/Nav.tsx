"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Rol } from "@/lib/types";
import SyncStatusBadge from "./SyncStatusBadge";

export default function Nav({ nombre, rol }: { nombre: string; rol: Rol }) {
  const pathname = usePathname();
  const router = useRouter();

  const links =
    rol === "encargado"
      ? [
          { href: "/", label: "Grilla" },
          { href: "/entregar", label: "Cargar entrega" },
          { href: "/admin/lotes", label: "Lotes" },
          { href: "/admin/alimentos", label: "Alimentos" },
          { href: "/admin/usuarios", label: "Usuarios" },
        ]
      : [{ href: "/", label: "Cargar entrega" }];

  async function salir() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
        <span className="flex items-center gap-2 font-bold text-brand-800">
          <img src="/logo-las-helenas.jpg" alt="" className="h-7 w-7 rounded-md object-cover" />
          Operaciones
        </span>

        <nav className="flex flex-1 flex-wrap gap-1">
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

        <SyncStatusBadge />

        <div className="flex items-center gap-2 text-sm text-stone-500">
          <span>{nombre}</span>
          <button onClick={salir} className="text-stone-400 hover:text-stone-700" title="Cerrar sesión">
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}

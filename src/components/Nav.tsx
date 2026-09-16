"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Campo, Modulo, Rol } from "@/lib/types";
import BotonSalir from "./BotonSalir";
import CampoSelector from "./CampoSelector";
import SyncStatusBadge from "./SyncStatusBadge";

export default function Nav({
  nombre,
  rol,
  campo,
  campos,
  modulos,
}: {
  nombre: string;
  rol: Rol;
  campo: Campo | null;
  campos: Campo[];
  modulos: Modulo[];
}) {
  const pathname = usePathname();
  const [menuAbierto, setMenuAbierto] = useState(false);

  const veTodo = rol === "encargado" || rol === "gerente" || rol === "dueno";

  const linksAlimentos = !modulos.includes("alimentos")
    ? []
    : veTodo
      ? [
          { href: "/alimentos", label: "Stock" },
          { href: "/alimentos/historial", label: "Historial de movimientos" },
          { href: "/entregar", label: "Cargar entrega" },
          { href: "/admin/base-datos-alimentos", label: "Base de datos" },
        ]
      : [{ href: "/entregar", label: "Cargar entrega" }];

  const linksMateriales = !modulos.includes("materiales")
    ? []
    : veTodo
      ? [
          { href: "/stock", label: "Stock" },
          { href: "/stock/historial", label: "Historial de movimientos" },
          { href: "/stock/cargar", label: "Cargar movimiento" },
          { href: "/admin/base-datos", label: "Base de datos" },
        ]
      : [{ href: "/stock/cargar", label: "Cargar movimiento" }];

  // Los módulos son lo de "Operaciones"; si tiene más de uno habilitado acá
  // puede volver a elegir cuál quiere ver.
  const linksModulos = [
    ...linksAlimentos,
    ...linksMateriales,
    ...(modulos.length > 1 ? [{ href: "/elegir-modulo", label: "Cambiar módulo" }] : []),
  ];

  // Usuarios/Campos quedan separados de "Operaciones": son globales, no de
  // un módulo puntual (gestionar usuarios es parte del módulo Alimentos,
  // así que un administrador de sólo Materiales no ve esta solapa).
  const linksGestion = [
    ...((rol === "encargado" && modulos.includes("alimentos")) || rol === "dueno"
      ? [{ href: "/admin/usuarios", label: "Usuarios" }]
      : []),
    ...(rol === "dueno" ? [{ href: "/admin/campos", label: "Campos" }] : []),
  ];

  // Si cambia de página (se tocó un link), cerrar el menú de celular.
  useEffect(() => {
    setMenuAbierto(false);
  }, [pathname]);

  const logo = (
    <Link href="/" className="flex items-center gap-2 font-bold text-brand-800">
      <img src="/logo-las-helenas.jpg" alt="" className="h-7 w-7 rounded-md object-cover" />
      Operaciones
    </Link>
  );

  // Cualquiera puede pertenecer a más de un campo ahora: el selector aparece
  // apenas hay más de uno, sea Dueño o no.
  const selectorCampo = !campo
    ? null
    : campos.length > 1
      ? <CampoSelector campos={campos} campoActualId={campo.id} />
      : <span className="rounded-lg bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">{campo.nombre}</span>;

  return (
    <header className="relative border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-nowrap items-center gap-3 px-4 py-3">
        {/* Botón hamburguesa: sólo en celular */}
        <button
          onClick={() => setMenuAbierto((v) => !v)}
          className="shrink-0 rounded-md p-1.5 text-stone-600 hover:bg-stone-100 md:hidden"
          aria-label="Abrir menú"
          aria-expanded={menuAbierto}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="shrink-0">{logo}</div>

        <div className="hidden shrink-0 md:block">{selectorCampo}</div>

        {/* Nav horizontal: sólo en pantallas medianas/grandes. Si no entran todos
            los links, se desliza horizontalmente en vez de pasar a otra línea. */}
        <nav className="hidden min-w-0 flex-1 items-center gap-0.5 overflow-x-auto md:flex">
          {linksModulos.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`shrink-0 whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium ${
                pathname === link.href
                  ? "bg-brand-100 text-brand-800"
                  : "text-stone-600 hover:bg-stone-100"
              }`}
            >
              {link.label}
            </Link>
          ))}
          {linksGestion.length > 0 && <div className="mx-1 h-5 w-px shrink-0 bg-stone-200" />}
          {linksGestion.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`shrink-0 whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium ${
                pathname === link.href
                  ? "bg-brand-100 text-brand-800"
                  : "text-stone-600 hover:bg-stone-100"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-3">
          <SyncStatusBadge />
          <div className="hidden items-center gap-2 text-sm text-stone-500 md:flex">
            <span className="whitespace-nowrap">{nombre}</span>
            <BotonSalir className="shrink-0 text-stone-400 hover:text-stone-700" />
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
              {linksModulos.map((link) => (
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
              {linksGestion.length > 0 && <div className="my-1 border-t border-stone-100" />}
              {linksGestion.map((link) => (
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
              <BotonSalir className="font-medium text-stone-600 hover:text-stone-900" />
            </div>
          </div>
        </>
      )}
    </header>
  );
}

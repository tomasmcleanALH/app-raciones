"use client";

import { useEffect, useRef, useState } from "react";

interface Opcion {
  id: string;
  nombre: string;
}

/** Select con buscador: en vez de desplegar una lista larga para elegir con
 * scroll, se escribe para filtrar. Mismo resultado que un <select> (guarda
 * un id), pero usable con listas largas como la de Lotes. */
export default function BuscarSelect({
  opciones,
  value,
  onChange,
  placeholder = "Buscar...",
  required,
  disabled,
}: {
  opciones: Opcion[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const contenedorRef = useRef<HTMLDivElement>(null);

  const seleccionada = opciones.find((o) => o.id === value) ?? null;

  useEffect(() => {
    function alClickearFuera(e: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false);
        setTexto("");
      }
    }
    document.addEventListener("mousedown", alClickearFuera);
    return () => document.removeEventListener("mousedown", alClickearFuera);
  }, []);

  const filtradas = texto.trim()
    ? opciones.filter((o) => o.nombre.toLowerCase().includes(texto.trim().toLowerCase()))
    : opciones;

  function elegir(o: Opcion) {
    onChange(o.id);
    setTexto("");
    setAbierto(false);
  }

  function alPresionarTecla(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setAbierto(false);
      setTexto("");
      (e.target as HTMLInputElement).blur();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtradas.length === 1) elegir(filtradas[0]);
    }
  }

  return (
    <div ref={contenedorRef} className="relative">
      <input
        type="text"
        required={required && !value}
        disabled={disabled}
        value={abierto ? texto : (seleccionada?.nombre ?? "")}
        onFocus={() => {
          setAbierto(true);
          setTexto("");
        }}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={alPresionarTecla}
        placeholder={placeholder}
        autoComplete="off"
        className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 disabled:bg-stone-100 disabled:text-stone-400"
      />
      {abierto && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-stone-200 bg-white py-1 shadow-lg">
          {filtradas.length === 0 ? (
            <p className="px-3 py-2 text-sm text-stone-400">Sin resultados.</p>
          ) : (
            filtradas.map((o) => (
              <button
                type="button"
                key={o.id}
                onClick={() => elegir(o)}
                className={`block w-full px-3 py-2 text-left text-sm hover:bg-stone-50 ${
                  o.id === value ? "bg-brand-50 font-medium text-brand-800" : "text-stone-700"
                }`}
              >
                {o.nombre}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

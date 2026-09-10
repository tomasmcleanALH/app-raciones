// Supabase Auth necesita un "email" para loguear, pero acá dejamos que el
// encargado cargue un simple nombre de usuario (sin @ ni dominio real).
// Si lo que se cargó ya parece un email de verdad, se usa tal cual
// (por si en algún momento prefieren poner uno real).
const DOMINIO_INTERNO = "usuarios.local";

const ACENTOS: Record<string, string> = {
  á: "a", é: "e", í: "i", ó: "o", ú: "u", ü: "u", ñ: "n",
};

function sacarAcentos(texto: string): string {
  return texto.replace(/[áéíóúüñ]/g, (letra) => ACENTOS[letra] ?? letra);
}

export function normalizarUsuarioAEmail(valor: string): string {
  const v = valor.trim();
  if (v.includes("@")) return v.toLowerCase();

  const limpio = sacarAcentos(v.toLowerCase())
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]/g, "");

  return `${limpio}@${DOMINIO_INTERNO}`;
}

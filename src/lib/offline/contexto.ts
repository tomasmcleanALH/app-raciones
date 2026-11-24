import { createClient } from "@/lib/supabase/client";
import { conTope } from "./tope";

const COOKIE_CAMPO_ACTUAL = "campo_actual";

// Una pantalla recién armada por el servidor siempre coincide con la cookie del campo,
// salvo que la cookie apunte a un campo que ya no sirve (desactivado). Para no trabar
// ese caso, sólo se desconfía de pantallas "viejas" (copias guardadas en el celular).
const EDAD_MAXIMA_PANTALLA_FRESCA_MS = 5 * 60_000;

export type ContextoPantalla = "ok" | "campo" | "usuario";

function leerCookie(nombre: string): string | null {
  const par = document.cookie.split("; ").find((c) => c.startsWith(`${nombre}=`));
  return par ? decodeURIComponent(par.slice(nombre.length + 1)) : null;
}

/**
 * Las pantallas de cargar pueden venir de la copia guardada en el celular (sin señal o
 * con señal mala), y esa copia trae el campo y el usuario de la última vez que se abrió.
 * Esto comprueba que sigan siendo los de ahora, para no cargar en el campo equivocado.
 */
export async function verificarContextoPantalla(
  userId: string,
  campoId: string,
  generadoEn: number,
): Promise<ContextoPantalla> {
  try {
    const { data } = await conTope(createClient().auth.getSession(), 3_000);
    const usuarioActual = data.session?.user.id;
    if (usuarioActual && usuarioActual !== userId) return "usuario";
  } catch {
    // Sin poder leer la sesión no se puede afirmar nada: se sigue con la comprobación del campo.
  }

  const campoElegido = leerCookie(COOKIE_CAMPO_ACTUAL);
  const esCopiaVieja = Date.now() - generadoEn > EDAD_MAXIMA_PANTALLA_FRESCA_MS;
  if (campoElegido && campoElegido !== campoId && esCopiaVieja) return "campo";

  return "ok";
}

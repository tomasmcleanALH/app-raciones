/** Tiempo máximo que se espera a la red antes de dar el pedido por perdido (señal mala). */
export const TOPE_RED_MS = 8_000;

export class TopeAgotadoError extends Error {
  constructor() {
    super("Se agotó el tiempo de espera");
    this.name = "TopeAgotadoError";
  }
}

/**
 * Espera a `promesa` como máximo `ms` milisegundos. Si tarda más, rechaza con
 * TopeAgotadoError (el pedido original no se cancela: puede terminar igual).
 */
export function conTope<T>(promesa: PromiseLike<T>, ms: number = TOPE_RED_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TopeAgotadoError()), ms);
    Promise.resolve(promesa).then(
      (valor) => {
        clearTimeout(timer);
        resolve(valor);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

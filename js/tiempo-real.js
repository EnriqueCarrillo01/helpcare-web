import { obtenerApiBase } from './api.js';

// Conexión de Server-Sent Events con el backend. Las vistas se suscriben y
// refrescan sus datos cuando llega un aviso. EventSource reintenta solo si se
// corta la conexión.
const oyentes = new Set();
const oyentesEstado = new Set();
let fuente = null;

function notificarEstado(conectado) {
  oyentesEstado.forEach((fn) => fn(conectado));
}

export function conectar() {
  if (fuente) fuente.close();
  if (!('EventSource' in window)) return;
  fuente = new EventSource(`${obtenerApiBase()}/api/eventos`);
  fuente.onopen = () => notificarEstado(true);
  fuente.onerror = () => notificarEstado(false);
  ['centro', 'necesidad', 'donacion'].forEach((tipo) =>
    fuente.addEventListener(tipo, (e) => {
      let datos = {};
      try {
        datos = JSON.parse(e.data);
      } catch {
        return;
      }
      oyentes.forEach((fn) => fn(datos));
    })
  );
}

// Llama a fn cuando hay cambios, agrupando ráfagas de avisos en una sola recarga.
export function suscribir(fn, esperaMs = 500) {
  let temporizador = null;
  const envoltura = (evento) => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => fn(evento), esperaMs);
  };
  oyentes.add(envoltura);
  return () => {
    clearTimeout(temporizador);
    oyentes.delete(envoltura);
  };
}

export const alCambiarConexion = (fn) => oyentesEstado.add(fn);

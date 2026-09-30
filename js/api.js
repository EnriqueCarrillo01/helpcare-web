import { obtenerSesion, cerrarSesion } from './sesion.js';

const CONFIG = window.HELPCARE_CONFIG || {};
const CLAVE_API = 'helpcare_api_base';
const ES_LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
const ESPERA_MAXIMA_MS = 60000;
const AVISO_DESPERTAR_MS = 4000;

export class ErrorApi extends Error {
  constructor(mensaje, { status = 0, errores = [] } = {}) {
    super(mensaje);
    this.status = status;
    this.errores = errores;
  }
}

// En desarrollo local se puede cambiar la URL del backend desde la barra lateral.
// Publicado, siempre se usa la de config.js.
export function obtenerApiBase() {
  const guardada = ES_LOCAL ? localStorage.getItem(CLAVE_API) : null;
  return (guardada || CONFIG.apiBase || 'http://localhost:3000').replace(/\/+$/, '');
}

export function guardarApiBase(valor) {
  if (!ES_LOCAL) return;
  if (valor) localStorage.setItem(CLAVE_API, valor);
  else localStorage.removeItem(CLAVE_API);
}

export const permiteConfigurarApi = ES_LOCAL;

const oyentesSesionExpirada = new Set();
export const alExpirarSesion = (fn) => oyentesSesionExpirada.add(fn);

const oyentesEspera = new Set();
export const alCambiarEspera = (fn) => oyentesEspera.add(fn);
let pendientesLentas = 0;

// fetch con token, tiempo límite y mensajes claros. Si el servidor tarda (el
// plan gratuito de Render "duerme" el servicio), avisa que está despertando.
export async function api(ruta, { metodo = 'GET', cuerpo, query } = {}) {
  const url = new URL(obtenerApiBase() + ruta);
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    });
  }

  const sesion = obtenerSesion();
  const headers = { Accept: 'application/json' };
  if (cuerpo !== undefined) headers['Content-Type'] = 'application/json';
  if (sesion) headers.Authorization = `Bearer ${sesion.token}`;

  const control = new AbortController();
  const limite = setTimeout(() => control.abort(), ESPERA_MAXIMA_MS);
  let lenta = false;
  const aviso = setTimeout(() => {
    lenta = true;
    pendientesLentas += 1;
    oyentesEspera.forEach((fn) => fn(pendientesLentas > 0));
  }, AVISO_DESPERTAR_MS);

  let res;
  try {
    res = await fetch(url, {
      method: metodo,
      headers,
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      signal: control.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new ErrorApi('El servidor no respondió a tiempo. Intenta de nuevo en un momento.');
    }
    throw new ErrorApi(`No hay conexión con el servidor (${obtenerApiBase()}). Revisa tu internet o la dirección del backend.`);
  } finally {
    clearTimeout(limite);
    clearTimeout(aviso);
    if (lenta) {
      pendientesLentas -= 1;
      oyentesEspera.forEach((fn) => fn(pendientesLentas > 0));
    }
  }

  let datos = null;
  try {
    datos = await res.json();
  } catch {
    datos = null;
  }

  if (!res.ok) {
    // Token vencido o cuenta eliminada: se cierra la sesión local.
    if (res.status === 401 && sesion) {
      cerrarSesion();
      oyentesSesionExpirada.forEach((fn) => fn());
    }
    const errores = (datos && datos.errores) || [];
    const mensaje =
      (errores.length && errores.join('. ')) ||
      (datos && datos.error) ||
      (res.status === 429 ? 'Demasiados intentos; espera unos minutos.' : `Error ${res.status}`);
    throw new ErrorApi(mensaje, { status: res.status, errores });
  }
  return datos;
}

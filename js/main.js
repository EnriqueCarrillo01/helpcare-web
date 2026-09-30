import { obtenerSesion, cerrarSesion, alCambiarSesion } from './sesion.js';
import { alExpirarSesion, alCambiarEspera, permiteConfigurarApi, obtenerApiBase, guardarApiBase } from './api.js';
import { conectar, alCambiarConexion } from './tiempo-real.js';
import { h, vaciar, avisar, ROLES } from './ui.js';
import { navegar, recordarDestino } from './navegacion.js';

import vistaMapa from './vistas/mapa.js';
import vistaNecesidades from './vistas/necesidades.js';
import vistaNecesidad from './vistas/necesidad.js';
import vistaImpacto from './vistas/impacto.js';
import { vistaRegistro, vistaLogin } from './vistas/acceso.js';
import vistaCuenta from './vistas/cuenta.js';
import vistaMisDonaciones from './vistas/mis-donaciones.js';
import vistaInstitucion from './vistas/institucion.js';
import vistaAdmin from './vistas/admin.js';

// requiere: null = pública; 'sesion' = cualquier cuenta; o un rol concreto.
const RUTAS = {
  mapa: { vista: vistaMapa, titulo: 'Mapa de centros' },
  necesidades: { vista: vistaNecesidades, titulo: 'Necesidades' },
  necesidad: { vista: vistaNecesidad, titulo: 'Detalle de necesidad' },
  impacto: { vista: vistaImpacto, titulo: 'Impacto' },
  registro: { vista: vistaRegistro, titulo: 'Crear cuenta', soloAnonimo: true },
  login: { vista: vistaLogin, titulo: 'Iniciar sesión', soloAnonimo: true },
  cuenta: { vista: vistaCuenta, titulo: 'Mi cuenta', requiere: 'sesion' },
  'mis-donaciones': { vista: vistaMisDonaciones, titulo: 'Mis donaciones', requiere: 'donante' },
  institucion: { vista: vistaInstitucion, titulo: 'Mi institución', requiere: 'institucion' },
  admin: { vista: vistaAdmin, titulo: 'Administración', requiere: 'administrador' },
};

const desk = document.getElementById('desk');
let limpiarVista = null;

function leerRuta() {
  const [nombre = 'mapa', ...params] = location.hash.replace(/^#\/?/, '').split('/');
  return { nombre: RUTAS[nombre] ? nombre : 'mapa', params };
}

async function renderizar() {
  const { nombre, params } = leerRuta();
  const ruta = RUTAS[nombre];
  const sesion = obtenerSesion();

  if (ruta.requiere && !sesion) {
    recordarDestino();
    navegar('login');
    return;
  }
  if (ruta.requiere && ruta.requiere !== 'sesion' && sesion.usuario.rol !== ruta.requiere) {
    navegar('cuenta');
    return;
  }
  if (ruta.soloAnonimo && sesion) {
    navegar('cuenta');
    return;
  }

  if (limpiarVista) limpiarVista();
  limpiarVista = null;
  document.title = `${ruta.titulo} · HelpCare`;
  document.querySelectorAll('.nav-item').forEach((a) => {
    const activo = a.dataset.ruta === nombre || (nombre === 'necesidad' && a.dataset.ruta === 'necesidades');
    a.classList.toggle('is-active', activo);
    if (activo) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });

  desk.className = 'desk';
  vaciar(desk);
  const resultado = await ruta.vista(desk, params);
  if (typeof resultado === 'function') limpiarVista = resultado;
}

function actualizarBarra() {
  const sesion = obtenerSesion();
  const u = sesion && sesion.usuario;
  document.getElementById('session-status').textContent = u
    ? `${u.nombre} · ${ROLES[u.rol]}${u.estado === 'pendiente' ? ' (en revisión)' : ''}`
    : 'Sin iniciar sesión';
  document.getElementById('logout-button').hidden = !u;
  document.querySelectorAll('.nav-item[data-si]').forEach((a) => {
    const si = a.dataset.si;
    a.hidden = si === 'anonimo' ? Boolean(u) : si === 'sesion' ? !u : !u || u.rol !== si;
  });
}

document.getElementById('logout-button').addEventListener('click', () => {
  cerrarSesion();
  avisar('Cerraste sesión.');
  navegar('mapa');
});

// Si la sesión se cierra (aquí o en otra pestaña) y la página actual la exige,
// se vuelve a evaluar la ruta. Al iniciar sesión, la vista de acceso navega sola.
alCambiarSesion((sesion) => {
  actualizarBarra();
  const ruta = RUTAS[leerRuta().nombre];
  if (!sesion && ruta.requiere) renderizar();
});

alExpirarSesion(() => {
  avisar('Tu sesión expiró. Inicia sesión de nuevo.', 'error');
  navegar('login');
});

// Aviso cuando el servidor tarda en responder (Render gratuito lo pone a dormir).
const avisoEspera = h('p', { class: 'aviso-espera', hidden: true }, 'El servidor está despertando; puede tardar hasta un minuto…');
document.body.append(avisoEspera);
alCambiarEspera((esperando) => {
  avisoEspera.hidden = !esperando;
});

alCambiarConexion((conectado) => {
  document.getElementById('en-vivo').hidden = !conectado;
});

if (permiteConfigurarApi) {
  const panel = document.getElementById('config-servidor');
  const input = document.getElementById('api-base');
  panel.hidden = false;
  input.value = obtenerApiBase();
  input.addEventListener('change', () => {
    guardarApiBase(input.value.trim());
    avisar('Dirección del backend actualizada.');
    conectar();
    renderizar();
  });
}

window.addEventListener('hashchange', renderizar);
actualizarBarra();
conectar();
renderizar();

import { api } from '../api.js';
import { suscribir } from '../tiempo-real.js';
import { pestanas } from './pestanas.js';
import {
  h, vaciar, campo, selector, avisar, conEspera, TIPOS, ROLES, ESTADOS_CUENTA, urgenciaChip, formatoNumero,
  formatoFecha, cargando, errorCarga, vacio, paginador,
} from '../ui.js';

export default function vistaAdmin(desk) {
  const vista = h('section', { class: 'view view--ancha' }, h('h1', {}, 'Administración'));
  desk.append(vista);
  return pestanas(vista, [
    { titulo: 'Necesidades por aprobar', pintar: pintarNecesidades },
    { titulo: 'Instituciones por aprobar', pintar: pintarInstituciones },
    { titulo: 'Cuentas', pintar: pintarCuentas },
  ]);
}

// Botones Aprobar / Rechazar con confirmación para el rechazo.
function decision(ruta, aprobar, rechazar, nombre, alTerminar) {
  const decidir = async (boton, estado) => {
    if (estado === rechazar.valor && !window.confirm(`¿Rechazar "${nombre}"?`)) return;
    try {
      await conEspera(boton, 'Guardando…', () => api(ruta, { metodo: 'PATCH', cuerpo: { estado } }));
      avisar(estado === aprobar.valor ? `"${nombre}" aprobada.` : `"${nombre}" rechazada.`);
      alTerminar();
    } catch (err) {
      avisar(err.message, 'error');
      alTerminar();
    }
  };
  const si = h('button', { type: 'button', class: 'mini', onclick: () => decidir(si, aprobar.valor) }, aprobar.texto);
  const no = h('button', { type: 'button', class: 'mini secundario', onclick: () => decidir(no, rechazar.valor) }, rechazar.texto);
  return h('div', { class: 'acciones' }, si, no);
}

async function pintarNecesidades(panel) {
  const estado = { pagina: 1 };
  const lista = h('div', {}, cargando());
  panel.append(h('p', { class: 'view-intro' }, 'Revisa que cada necesidad sea clara y verosímil antes de publicarla en el mapa.'), lista);

  async function cargar() {
    try {
      const r = await api('/api/admin/necesidades', { query: { estado: 'pendiente', pagina: estado.pagina, porPagina: 10 } });
      if (!r.items.length) {
        vaciar(lista, vacio('No hay necesidades esperando revisión.'));
        return;
      }
      vaciar(
        lista,
        h(
          'ol',
          { class: 'lista-necesidades' },
          r.items.map((n) =>
            h(
              'li',
              { class: 'necesidad-item' },
              h('div', { class: 'necesidad-cabecera' }, h('h2', {}, n.titulo), urgenciaChip(n.urgencia)),
              h('p', { class: 'necesidad-meta' }, `${formatoNumero(n.cantidadRequerida)} ${n.unidad} · ${TIPOS[n.tipo]}`),
              h('p', { class: 'necesidad-meta' }, `${n.institucion.nombre} · ${n.centro.nombre}, ${n.centro.direccion}`),
              n.descripcion ? h('p', {}, n.descripcion) : null,
              h('p', { class: 'field-hint' }, `Enviada ${formatoFecha(n.creadoEn)}`),
              decision(`/api/admin/necesidades/${n.id}`, { valor: 'abierta', texto: 'Aprobar y publicar' }, { valor: 'rechazada', texto: 'Rechazar' }, n.titulo, cargar)
            )
          )
        ),
        paginador(r, (p) => {
          estado.pagina = p;
          cargar();
        })
      );
    } catch (err) {
      vaciar(lista, errorCarga(err, cargar));
    }
  }

  await cargar();
  return suscribir(() => cargar());
}

async function pintarInstituciones(panel) {
  const estado = { pagina: 1 };
  const lista = h('div', {}, cargando());
  panel.append(h('p', { class: 'view-intro' }, 'Verifica que la organización exista antes de aprobarla: podrá publicar centros y necesidades.'), lista);

  async function cargar() {
    try {
      const r = await api('/api/admin/instituciones', { query: { estado: 'pendiente', pagina: estado.pagina, porPagina: 10 } });
      if (!r.items.length) {
        vaciar(lista, vacio('No hay instituciones esperando revisión.'));
        return;
      }
      vaciar(
        lista,
        h(
          'ol',
          { class: 'lista-necesidades' },
          r.items.map((u) =>
            h(
              'li',
              { class: 'necesidad-item' },
              h('h2', {}, u.organizacion),
              h('p', { class: 'necesidad-meta' }, `Contacto: ${u.nombre} · `, h('a', { class: 'enlace', href: `mailto:${u.email}` }, u.email)),
              h('p', { class: 'field-hint' }, `Registrada ${formatoFecha(u.creadoEn)}`),
              decision(`/api/admin/instituciones/${u.id}`, { valor: 'activo', texto: 'Aprobar' }, { valor: 'rechazado', texto: 'Rechazar' }, u.organizacion, cargar)
            )
          )
        ),
        paginador(r, (p) => {
          estado.pagina = p;
          cargar();
        })
      );
    } catch (err) {
      vaciar(lista, errorCarga(err, cargar));
    }
  }

  await cargar();
}

async function pintarCuentas(panel) {
  const estado = { pagina: 1, rol: '' };
  const rol = selector('rol', ROLES, { vacioTexto: 'Todos' });
  const lista = h('div', {}, cargando());
  panel.append(
    h('div', { class: 'filtros filtros--fila' }, campo('Tipo de cuenta', rol)),
    h('p', { class: 'field-hint' }, 'Para crear otra cuenta de administración, usa POST /api/auth/registro con tu sesión de administrador (ver README del backend).'),
    lista
  );

  async function cargar() {
    try {
      const r = await api('/api/donantes', { query: { rol: estado.rol, pagina: estado.pagina, porPagina: 20 } });
      if (!r.items.length) {
        vaciar(lista, vacio('No hay cuentas de ese tipo.'));
        return;
      }
      vaciar(
        lista,
        h('p', { class: 'field-hint' }, `${formatoNumero(r.total)} ${r.total === 1 ? 'cuenta' : 'cuentas'}`),
        h(
          'div',
          { class: 'tabla-desplazable' },
          h(
            'table',
            { class: 'ledger' },
            h('thead', {}, h('tr', {}, ['Nombre', 'Correo', 'Tipo', 'Estado', 'Alta'].map((t) => h('th', { scope: 'col' }, t)))),
            h(
              'tbody',
              {},
              r.items.map((u) =>
                h(
                  'tr',
                  {},
                  h('td', {}, u.organizacion ? [u.organizacion, h('br'), h('span', { class: 'field-hint' }, u.nombre)] : u.nombre),
                  h('td', {}, u.email),
                  h('td', {}, h('span', { class: 'role-chip' }, ROLES[u.rol])),
                  h('td', {}, ESTADOS_CUENTA[u.estado]),
                  h('td', {}, formatoFecha(u.creadoEn))
                )
              )
            )
          )
        ),
        paginador(r, (p) => {
          estado.pagina = p;
          cargar();
        })
      );
    } catch (err) {
      vaciar(lista, errorCarga(err, cargar));
    }
  }

  rol.addEventListener('change', () => {
    Object.assign(estado, { rol: rol.value, pagina: 1 });
    cargar();
  });
  await cargar();
}

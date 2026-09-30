import { api } from '../api.js';
import { suscribir } from '../tiempo-real.js';
import { abrirDonacion } from '../donar.js';
import {
  h, vaciar, TIPOS, ESTADOS_NECESIDAD, ESTADOS_DONACION, urgenciaChip, estadoChip, avance, formatoFecha,
  formatoNumero, enlaceComoLlegar, cargando, errorCarga,
} from '../ui.js';

export default async function vistaNecesidad(desk, [id]) {
  const vista = h('section', { class: 'view' }, cargando());
  desk.append(vista);

  async function cargar() {
    try {
      const n = await api(`/api/necesidades/${encodeURIComponent(id)}`);
      const c = n.centro;
      vaciar(
        vista,
        h('p', { class: 'migas' }, h('a', { class: 'enlace', href: '#/necesidades' }, 'Necesidades')),
        h('h1', {}, n.titulo),
        h(
          'p',
          { class: 'chips' },
          urgenciaChip(n.urgencia),
          estadoChip(ESTADOS_NECESIDAD[n.estado], n.estado),
          h('span', { class: 'estado' }, TIPOS[n.tipo])
        ),
        n.descripcion ? h('p', { class: 'view-intro' }, n.descripcion) : null,
        avance(n),
        n.estado === 'abierta' && n.restante > 0
          ? h('button', { type: 'button', class: 'primary-button', onclick: () => abrirDonacion(n, c, cargar) }, 'Donar')
          : null,

        h('h2', { class: 'subtitulo' }, 'Dónde entregar'),
        h(
          'dl',
          { class: 'record' },
          fila('Centro', c.nombre),
          n.institucion ? fila('Institución', n.institucion.nombre) : null,
          fila('Dirección', c.direccion),
          c.horario ? fila('Horario', c.horario) : null
        ),
        h('p', { class: 'acciones' }, h('a', { class: 'enlace', href: `#/mapa/${c.id}` }, 'Ver en el mapa'), enlaceComoLlegar(c)),

        h('h2', { class: 'subtitulo' }, 'Seguimiento'),
        n.seguimiento.length
          ? h(
              'ol',
              { class: 'seguimiento' },
              n.seguimiento.map((d) =>
                h(
                  'li',
                  { class: `seguimiento-item seguimiento--${d.estado}` },
                  h('span', { class: 'seguimiento-cantidad' }, `${formatoNumero(d.cantidad)} ${n.unidad}`),
                  estadoChip(ESTADOS_DONACION[d.estado], d.estado),
                  h('time', { datetime: d.actualizadoEn }, formatoFecha(d.actualizadoEn))
                )
              )
            )
          : h('p', { class: 'record-empty' }, 'Aún no hay donaciones comprometidas. La tuya puede ser la primera.'),
        h('p', { class: 'field-hint' }, 'Las entregas las confirma la institución que las recibe. No se muestra quién dona.')
      );
    } catch (err) {
      vaciar(vista, errorCarga(err.status === 404 ? new Error('Esta necesidad no existe o todavía no se publica.') : err, err.status === 404 ? null : cargar));
    }
  }

  function fila(dt, dd) {
    return h('div', { class: 'record-row' }, h('dt', {}, dt), h('dd', {}, dd));
  }

  await cargar();
  return suscribir((e) => {
    if (e.necesidadId === Number(id) || e.id === Number(id)) cargar();
  });
}

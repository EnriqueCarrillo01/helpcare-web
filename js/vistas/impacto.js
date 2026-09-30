import { api } from '../api.js';
import { suscribir } from '../tiempo-real.js';
import { h, vaciar, TIPOS, formatoNumero, formatoFecha, cargando, errorCarga } from '../ui.js';

export default async function vistaImpacto(desk) {
  const vista = h('section', { class: 'view view--ancha' }, cargando());
  desk.append(vista);

  async function cargar() {
    try {
      const d = await api('/api/impacto');
      const maxTipo = Math.max(1, ...d.porTipo.map((t) => t.unidadesEntregadas));
      vaciar(
        vista,
        h('h1', {}, `${formatoNumero(d.unidadesEntregadas)} unidades entregadas`),
        h(
          'p',
          { class: 'view-intro' },
          `Solo cuentan las entregas que confirmó la institución que las recibió: ${formatoNumero(d.donacionesEntregadas)} donaciones de ${formatoNumero(d.donantesParticipantes)} ${d.donantesParticipantes === 1 ? 'persona' : 'personas'}.`
        ),
        h(
          'div',
          { class: 'cifras' },
          cifra(d.necesidadesCubiertas, 'necesidades cubiertas por completo'),
          cifra(d.necesidadesAbiertas, `necesidades abiertas, ${d.necesidadesCriticas} críticas`),
          cifra(d.centrosActivos, 'centros de acopio activos'),
          cifra(d.institucionesActivas, 'instituciones verificadas')
        ),
        d.porTipo.length
          ? [
              h('h2', { class: 'subtitulo' }, 'Entregado por tipo de ayuda'),
              h(
                'ul',
                { class: 'barras' },
                d.porTipo.map((t) => {
                  const barra = h('span', { class: 'barra-relleno' });
                  barra.style.width = `${Math.round((t.unidadesEntregadas / maxTipo) * 100)}%`;
                  return h(
                    'li',
                    {},
                    h('span', { class: 'barra-etiqueta' }, TIPOS[t.tipo]),
                    h('span', { class: 'barra' }, barra),
                    h('span', { class: 'barra-valor' }, formatoNumero(t.unidadesEntregadas))
                  );
                })
              ),
            ]
          : null,
        h('h2', { class: 'subtitulo' }, 'Últimas entregas confirmadas'),
        d.ultimasEntregas.length
          ? h(
              'ol',
              { class: 'seguimiento' },
              d.ultimasEntregas.map((e) =>
                h(
                  'li',
                  { class: 'seguimiento-item' },
                  h('span', { class: 'seguimiento-cantidad' }, `${formatoNumero(e.cantidad)} ${e.unidad}`),
                  h('a', { href: `#/necesidad/${e.necesidadId}` }, `${e.titulo} · ${e.centro}`),
                  h('time', { datetime: e.fecha }, formatoFecha(e.fecha))
                )
              )
            )
          : h('p', { class: 'record-empty' }, 'Todavía no hay entregas confirmadas.')
      );
    } catch (err) {
      vaciar(vista, errorCarga(err, cargar));
    }
  }

  function cifra(valor, texto) {
    return h('p', { class: 'cifra' }, h('span', { class: 'cifra-valor' }, formatoNumero(valor)), h('span', { class: 'cifra-texto' }, texto));
  }

  await cargar();
  return suscribir(() => cargar());
}

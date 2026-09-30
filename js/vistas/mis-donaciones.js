import { api } from '../api.js';
import { suscribir } from '../tiempo-real.js';
import {
  h, vaciar, ESTADOS_DONACION, estadoChip, formatoNumero, formatoFecha, enlaceComoLlegar, avisar, conEspera,
  cargando, errorCarga, vacio, paginador,
} from '../ui.js';

export default async function vistaMisDonaciones(desk) {
  const estado = { pagina: 1 };
  const lista = h('div', {}, cargando());
  desk.append(
    h(
      'section',
      { class: 'view view--ancha' },
      h('h1', {}, 'Mis donaciones'),
      h('p', { class: 'view-intro' }, 'Avisa cuando vayas en camino. El centro confirma la entrega al recibirla.'),
      lista
    )
  );

  async function cambiar(boton, d, nuevo) {
    if (nuevo === 'cancelada' && !window.confirm('¿Cancelar esta donación? La cantidad vuelve a quedar disponible para otras personas.')) return;
    try {
      await conEspera(boton, 'Guardando…', () => api(`/api/donaciones/${d.id}`, { metodo: 'PATCH', cuerpo: { estado: nuevo } }));
      avisar(nuevo === 'en_camino' ? 'Listo: el centro sabe que vas en camino.' : 'Donación cancelada.');
      cargar();
    } catch (err) {
      avisar(err.message, 'error');
    }
  }

  function acciones(d) {
    const botones = [];
    if (d.estado === 'comprometida') {
      const b = h('button', { type: 'button', class: 'primary-button', onclick: () => cambiar(b, d, 'en_camino') }, 'Voy en camino');
      botones.push(b);
    }
    if (d.estado === 'comprometida' || d.estado === 'en_camino') {
      const b = h('button', { type: 'button', class: 'secundario', onclick: () => cambiar(b, d, 'cancelada') }, 'Cancelar');
      botones.push(b);
    }
    return botones.length ? h('div', { class: 'acciones' }, botones) : null;
  }

  async function cargar() {
    try {
      const r = await api('/api/donaciones/mias', { query: { pagina: estado.pagina, porPagina: 10 } });
      if (!r.items.length) {
        vaciar(lista, vacio('Aún no te has comprometido con ninguna necesidad.', h('a', { class: 'primary-button', href: '#/mapa' }, 'Buscar dónde donar')));
        return;
      }
      vaciar(
        lista,
        h(
          'ol',
          { class: 'lista-necesidades' },
          r.items.map((d) =>
            h(
              'li',
              { class: 'necesidad-item' },
              h(
                'div',
                { class: 'necesidad-cabecera' },
                h('h2', {}, h('a', { href: `#/necesidad/${d.necesidad.id}` }, `${formatoNumero(d.cantidad)} ${d.necesidad.unidad} · ${d.necesidad.titulo}`)),
                estadoChip(ESTADOS_DONACION[d.estado], d.estado)
              ),
              h('p', { class: 'necesidad-meta' }, `${d.centro.nombre} · ${d.centro.direccion}`),
              d.centro.horario ? h('p', { class: 'necesidad-meta' }, `Horario: ${d.centro.horario}`) : null,
              h('p', { class: 'necesidad-meta' }, `Actualizada ${formatoFecha(d.actualizadoEn)}`, ' · ', enlaceComoLlegar(d.centro)),
              acciones(d)
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

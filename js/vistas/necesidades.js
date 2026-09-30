import { api } from '../api.js';
import { suscribir } from '../tiempo-real.js';
import { abrirDonacion } from '../donar.js';
import { h, vaciar, selector, campo, TIPOS, URGENCIAS, urgenciaChip, avance, cargando, errorCarga, vacio, paginador } from '../ui.js';

export default async function vistaNecesidades(desk) {
  const estado = { tipo: '', urgencia: '', pagina: 1 };
  const tipo = selector('tipo', TIPOS, { vacioTexto: 'Todos los tipos' });
  const urgencia = selector('urgencia', URGENCIAS, { vacioTexto: 'Cualquier urgencia' });
  const lista = h('div', { class: 'necesidades' });

  desk.append(
    h(
      'section',
      { class: 'view view--ancha' },
      h('h1', {}, 'Lo que hace falta ahora'),
      h('p', { class: 'view-intro' }, 'Necesidades aprobadas por HelpCare, ordenadas por urgencia. Comprométete con una cantidad y entrégala directamente en el centro.'),
      h('div', { class: 'filtros filtros--fila' }, campo('Tipo de ayuda', tipo), campo('Urgencia', urgencia)),
      lista
    )
  );

  async function cargar() {
    if (!lista.childElementCount) vaciar(lista, cargando());
    try {
      const r = await api('/api/necesidades', {
        query: { tipo: estado.tipo, urgencia: estado.urgencia, pagina: estado.pagina, porPagina: 12 },
      });
      if (r.items.length === 0) {
        vaciar(lista, vacio(estado.tipo || estado.urgencia ? 'No hay necesidades con esos filtros.' : 'No hay necesidades abiertas en este momento.'));
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
              h(
                'div',
                { class: 'necesidad-cabecera' },
                h('h2', {}, h('a', { href: `#/necesidad/${n.id}` }, n.titulo)),
                urgenciaChip(n.urgencia)
              ),
              h('p', { class: 'necesidad-meta' }, `${TIPOS[n.tipo]} · ${n.centro.nombre}`),
              avance(n),
              h(
                'div',
                { class: 'acciones' },
                n.restante > 0
                  ? h('button', { type: 'button', class: 'primary-button', onclick: () => abrirDonacion(n, n.centro, cargar) }, 'Donar')
                  : null,
                h('a', { class: 'enlace', href: `#/mapa/${n.centro.id}` }, 'Ver en el mapa')
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

  tipo.addEventListener('change', () => {
    Object.assign(estado, { tipo: tipo.value, pagina: 1 });
    cargar();
  });
  urgencia.addEventListener('change', () => {
    Object.assign(estado, { urgencia: urgencia.value, pagina: 1 });
    cargar();
  });

  await cargar();
  return suscribir(() => cargar());
}

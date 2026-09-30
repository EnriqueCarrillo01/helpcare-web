import { api } from '../api.js';
import { usuarioActual } from '../sesion.js';
import { suscribir } from '../tiempo-real.js';
import { pestanas } from './pestanas.js';
import {
  h, vaciar, campo, selector, abrirDialogo, avisar, conEspera, mensajeFormulario, mostrarError, TIPOS, URGENCIAS,
  ESTADOS_NECESIDAD, ESTADOS_DONACION, urgenciaChip, estadoChip, avance, formatoNumero, formatoFecha, cargando,
  errorCarga, vacio, paginador,
} from '../ui.js';

export default async function vistaInstitucion(desk) {
  const u = usuarioActual();
  const vista = h('section', { class: 'view view--ancha' }, h('h1', {}, u.organizacion || u.nombre));
  desk.append(vista);

  if (u.estado !== 'activo') {
    vista.append(
      h(
        'p',
        { class: 'nota-estado' },
        'Tu institución está en revisión. Cuando un administrador la apruebe podrás registrar centros de acopio y publicar necesidades.'
      ),
      h('a', { class: 'secundario', href: '#/cuenta' }, 'Revisar el estado de mi cuenta')
    );
    return undefined;
  }

  return pestanas(vista, [
    { titulo: 'Donaciones por recibir', pintar: pintarDonaciones },
    { titulo: 'Necesidades', pintar: pintarNecesidades },
    { titulo: 'Centros de acopio', pintar: pintarCentros },
  ]);
}

// ---------------------------------------------------------------- Donaciones
async function pintarDonaciones(panel) {
  const estado = { filtro: '', pagina: 1 };
  const filtro = selector('estado', ESTADOS_DONACION, { vacioTexto: 'Todas' });
  const lista = h('div', {}, cargando());
  panel.append(
    h('p', { class: 'view-intro' }, 'Confirma cada entrega cuando la recibas: así la donación cuenta en el impacto y la necesidad se actualiza.'),
    h('div', { class: 'filtros filtros--fila' }, campo('Estado', filtro)),
    lista
  );

  async function cambiar(boton, d, nuevo) {
    if (nuevo === 'cancelada' && !window.confirm('¿Marcar que esta donación no llegó? La cantidad volverá a estar disponible.')) return;
    try {
      await conEspera(boton, 'Guardando…', () => api(`/api/donaciones/${d.id}`, { metodo: 'PATCH', cuerpo: { estado: nuevo } }));
      avisar(nuevo === 'entregada' ? 'Entrega confirmada.' : 'Donación marcada como no recibida.');
      cargar();
    } catch (err) {
      avisar(err.message, 'error');
    }
  }

  async function cargar() {
    try {
      const r = await api('/api/donaciones/recibidas', { query: { estado: estado.filtro, pagina: estado.pagina, porPagina: 15 } });
      if (!r.items.length) {
        vaciar(lista, vacio('No hay donaciones con ese estado.'));
        return;
      }
      vaciar(
        lista,
        h(
          'div',
          { class: 'tabla-desplazable' },
          h(
            'table',
            { class: 'ledger' },
            h('thead', {}, h('tr', {}, ['Donación', 'Quién dona', 'Centro', 'Estado', ''].map((t) => h('th', { scope: 'col' }, t)))),
            h(
              'tbody',
              {},
              r.items.map((d) => {
                const activa = d.estado === 'comprometida' || d.estado === 'en_camino';
                const confirmar = h('button', { type: 'button', class: 'mini', onclick: () => cambiar(confirmar, d, 'entregada') }, 'Confirmar entrega');
                const noLlego = h('button', { type: 'button', class: 'mini secundario', onclick: () => cambiar(noLlego, d, 'cancelada') }, 'No llegó');
                return h(
                  'tr',
                  {},
                  h('td', {}, h('strong', {}, `${formatoNumero(d.cantidad)} ${d.necesidad.unidad}`), h('br'), d.necesidad.titulo, d.nota ? h('p', { class: 'field-hint' }, `“${d.nota}”`) : null),
                  h('td', {}, d.donante ? [d.donante.nombre, h('br'), h('a', { class: 'enlace', href: `mailto:${d.donante.email}` }, d.donante.email)] : '—'),
                  h('td', {}, d.centro.nombre),
                  h('td', {}, estadoChip(ESTADOS_DONACION[d.estado], d.estado), h('br'), h('span', { class: 'field-hint' }, formatoFecha(d.actualizadoEn))),
                  h('td', { class: 'celda-acciones' }, activa ? [confirmar, noLlego] : null)
                );
              })
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

  filtro.addEventListener('change', () => {
    Object.assign(estado, { filtro: filtro.value, pagina: 1 });
    cargar();
  });
  await cargar();
  return suscribir(() => cargar());
}

// --------------------------------------------------------------- Necesidades
async function pintarNecesidades(panel) {
  const estado = { pagina: 1 };
  const lista = h('div', {}, cargando());
  const nueva = h('button', { type: 'button', class: 'primary-button', onclick: () => formularioNecesidad(cargar) }, 'Publicar necesidad');
  panel.append(
    h('p', { class: 'view-intro' }, 'Cada necesidad nueva la revisa un administrador antes de mostrarse en el mapa.'),
    nueva,
    lista
  );

  async function cerrar(boton, n) {
    if (!window.confirm(`¿Cerrar "${n.titulo}"? Ya no se podrán comprometer más donaciones.`)) return;
    try {
      await conEspera(boton, 'Cerrando…', () => api(`/api/necesidades/${n.id}`, { metodo: 'PATCH', cuerpo: { estado: 'cerrada' } }));
      avisar('Necesidad cerrada.');
      cargar();
    } catch (err) {
      avisar(err.message, 'error');
    }
  }

  async function cargar() {
    try {
      const r = await api('/api/necesidades/mias', { query: { pagina: estado.pagina, porPagina: 10 } });
      if (!r.items.length) {
        vaciar(lista, vacio('Aún no has publicado necesidades. Primero registra un centro de acopio y luego publica lo que hace falta.'));
        return;
      }
      vaciar(
        lista,
        h(
          'ol',
          { class: 'lista-necesidades' },
          r.items.map((n) => {
            const editable = n.estado === 'pendiente' || n.estado === 'abierta';
            const botonCerrar = h('button', { type: 'button', class: 'secundario', onclick: () => cerrar(botonCerrar, n) }, 'Cerrar');
            return h(
              'li',
              { class: 'necesidad-item' },
              h(
                'div',
                { class: 'necesidad-cabecera' },
                h('h2', {}, h('a', { href: `#/necesidad/${n.id}` }, n.titulo)),
                estadoChip(ESTADOS_NECESIDAD[n.estado], n.estado)
              ),
              h('p', { class: 'necesidad-meta' }, `${TIPOS[n.tipo]} · ${n.centro.nombre} · `, urgenciaChip(n.urgencia)),
              avance(n),
              editable
                ? h(
                    'div',
                    { class: 'acciones' },
                    h('button', { type: 'button', class: 'secundario', onclick: () => editarNecesidad(n, cargar) }, 'Editar'),
                    botonCerrar
                  )
                : null
            );
          })
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

async function formularioNecesidad(alTerminar) {
  let centros;
  try {
    centros = (await api('/api/centros/mios')).filter((c) => c.estado === 'activo');
  } catch (err) {
    avisar(err.message, 'error');
    return;
  }
  if (!centros.length) {
    abrirDialogo('Primero registra un centro', h('div', { class: 'dialogo-cuerpo' }, h('p', {}, 'Las necesidades se publican en un centro de acopio activo. Regístralo en la pestaña "Centros de acopio".')));
    return;
  }

  const opcionesCentro = Object.fromEntries(centros.map((c) => [c.id, c.nombre]));
  const centro = selector('centroId', opcionesCentro);
  const titulo = h('input', { type: 'text', name: 'titulo', required: true, minlength: 3, maxlength: 120, placeholder: 'Ej.: Agua embotellada de 1.5 L' });
  const tipo = selector('tipo', TIPOS);
  const urgencia = selector('urgencia', URGENCIAS, { valor: 'media' });
  const cantidad = h('input', { type: 'number', name: 'cantidadRequerida', min: 1, step: 1, required: true });
  const unidad = h('input', { type: 'text', name: 'unidad', required: true, maxlength: 40, placeholder: 'botellas, kits, turnos…' });
  const descripcion = h('textarea', { name: 'descripcion', rows: 3, maxlength: 1000 });
  const mensaje = mensajeFormulario();
  const boton = h('button', { type: 'submit', class: 'primary-button' }, 'Enviar a revisión');

  const form = h(
    'form',
    { class: 'desk-form dialogo-cuerpo', novalidate: true },
    campo('Centro de acopio', centro),
    campo('Qué se necesita', titulo),
    h('div', { class: 'fila-campos' }, campo('Tipo', tipo), campo('Urgencia', urgencia)),
    h('div', { class: 'fila-campos' }, campo('Cantidad', cantidad), campo('Unidad', unidad)),
    campo('Detalles (opcional)', descripcion, 'Tallas, marcas, caducidad mínima, horarios de voluntariado…'),
    boton,
    mensaje
  );
  const cerrar = abrirDialogo('Publicar necesidad', form);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const cuerpo = {
      centroId: Number(centro.value),
      titulo: titulo.value.trim(),
      tipo: tipo.value,
      urgencia: urgencia.value,
      cantidadRequerida: Number(cantidad.value),
      unidad: unidad.value.trim(),
      descripcion: descripcion.value.trim() || undefined,
    };
    if (cuerpo.titulo.length < 3 || !cuerpo.unidad || !Number.isInteger(cuerpo.cantidadRequerida) || cuerpo.cantidadRequerida < 1) {
      mostrarError(mensaje, new Error('Completa qué se necesita, la cantidad (número entero) y la unidad.'));
      return;
    }
    try {
      await conEspera(boton, 'Enviando…', () => api('/api/necesidades', { metodo: 'POST', cuerpo }));
      cerrar();
      avisar('Necesidad enviada a revisión.');
      alTerminar();
    } catch (err) {
      mostrarError(mensaje, err);
    }
  });
}

function editarNecesidad(n, alTerminar) {
  const urgencia = selector('urgencia', URGENCIAS, { valor: n.urgencia });
  const cantidad = h('input', { type: 'number', name: 'cantidadRequerida', min: Math.max(1, n.cantidadComprometida), step: 1, value: n.cantidadRequerida });
  const descripcion = h('textarea', { name: 'descripcion', rows: 3, maxlength: 1000 });
  descripcion.value = n.descripcion || '';
  const mensaje = mensajeFormulario();
  const boton = h('button', { type: 'submit', class: 'primary-button' }, 'Guardar cambios');
  const form = h(
    'form',
    { class: 'desk-form dialogo-cuerpo', novalidate: true },
    h('p', { class: 'dialogo-contexto' }, n.titulo),
    h('div', { class: 'fila-campos' }, campo('Urgencia', urgencia), campo(`Cantidad (${n.unidad})`, cantidad, n.cantidadComprometida ? `Mínimo ${n.cantidadComprometida}: ya están comprometidas.` : null)),
    campo('Detalles', descripcion),
    boton,
    mensaje
  );
  const cerrar = abrirDialogo('Editar necesidad', form);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await conEspera(boton, 'Guardando…', () =>
        api(`/api/necesidades/${n.id}`, {
          metodo: 'PATCH',
          cuerpo: { urgencia: urgencia.value, cantidadRequerida: Number(cantidad.value), descripcion: descripcion.value.trim() || undefined },
        })
      );
      cerrar();
      avisar('Cambios guardados.');
      alTerminar();
    } catch (err) {
      mostrarError(mensaje, err);
    }
  });
}

// ------------------------------------------------------------------- Centros
async function pintarCentros(panel) {
  const lista = h('div', {}, cargando());
  panel.append(
    h('p', { class: 'view-intro' }, 'Los centros activos aparecen en el mapa público con su ubicación y horario.'),
    h('button', { type: 'button', class: 'primary-button', onclick: () => formularioCentro(null, cargar) }, 'Agregar centro'),
    lista
  );

  async function alternar(boton, c) {
    const nuevo = c.estado === 'activo' ? 'inactivo' : 'activo';
    if (nuevo === 'inactivo' && !window.confirm(`¿Desactivar "${c.nombre}"? Dejará de verse en el mapa junto con sus necesidades.`)) return;
    try {
      await conEspera(boton, 'Guardando…', () => api(`/api/centros/${c.id}`, { metodo: 'PATCH', cuerpo: { estado: nuevo } }));
      avisar(nuevo === 'activo' ? 'Centro activado.' : 'Centro desactivado.');
      cargar();
    } catch (err) {
      avisar(err.message, 'error');
    }
  }

  async function cargar() {
    try {
      const centros = await api('/api/centros/mios');
      if (!centros.length) {
        vaciar(lista, vacio('Registra tu primer centro de acopio para empezar a recibir donaciones.'));
        return;
      }
      vaciar(
        lista,
        h(
          'ol',
          { class: 'lista-necesidades' },
          centros.map((c) => {
            const botonEstado = h('button', { type: 'button', class: 'secundario', onclick: () => alternar(botonEstado, c) }, c.estado === 'activo' ? 'Desactivar' : 'Activar');
            return h(
              'li',
              { class: 'necesidad-item' },
              h('div', { class: 'necesidad-cabecera' }, h('h2', {}, c.nombre), estadoChip(c.estado === 'activo' ? 'Activo' : 'Inactivo', c.estado === 'activo' ? 'abierta' : 'cerrada')),
              h('p', { class: 'necesidad-meta' }, c.direccion),
              c.horario ? h('p', { class: 'necesidad-meta' }, `Horario: ${c.horario}`) : null,
              h('p', { class: 'necesidad-meta' }, `${c.necesidadesActivas} ${c.necesidadesActivas === 1 ? 'necesidad activa' : 'necesidades activas'}`),
              h(
                'div',
                { class: 'acciones' },
                h('button', { type: 'button', class: 'secundario', onclick: () => formularioCentro(c, cargar) }, 'Editar'),
                botonEstado,
                c.estado === 'activo' ? h('a', { class: 'enlace', href: `#/mapa/${c.id}` }, 'Ver en el mapa') : null
              )
            );
          })
        )
      );
    } catch (err) {
      vaciar(lista, errorCarga(err, cargar));
    }
  }

  await cargar();
}

// Formulario de centro con un minimapa: un clic en el mapa fija las coordenadas.
function formularioCentro(centro, alTerminar) {
  const L = window.L;
  const base = (window.HELPCARE_CONFIG && window.HELPCARE_CONFIG.mapaCentro) || { lat: 17.9892, lng: -92.9281 };
  const nombre = h('input', { type: 'text', name: 'nombre', required: true, minlength: 2, maxlength: 120, value: centro ? centro.nombre : '' });
  const direccion = h('input', { type: 'text', name: 'direccion', required: true, minlength: 5, maxlength: 250, value: centro ? centro.direccion : '' });
  const horario = h('input', { type: 'text', name: 'horario', maxlength: 120, placeholder: 'Ej.: Lunes a viernes, 9:00 a 18:00', value: centro && centro.horario ? centro.horario : '' });
  const lat = h('input', { type: 'number', name: 'lat', step: 'any', min: -90, max: 90, required: true, value: centro ? centro.lat : '' });
  const lng = h('input', { type: 'number', name: 'lng', step: 'any', min: -180, max: 180, required: true, value: centro ? centro.lng : '' });
  const miniMapa = h('div', { class: 'mini-mapa', role: 'application', 'aria-label': 'Haz clic en el mapa para ubicar el centro' });
  const mensaje = mensajeFormulario();
  const boton = h('button', { type: 'submit', class: 'primary-button' }, centro ? 'Guardar cambios' : 'Registrar centro');

  const form = h(
    'form',
    { class: 'desk-form dialogo-cuerpo', novalidate: true },
    campo('Nombre del centro', nombre),
    campo('Dirección', direccion),
    campo('Horario de recepción', horario),
    h('p', { class: 'field-hint' }, 'Haz clic en el mapa para marcar la ubicación exacta, o escribe las coordenadas.'),
    miniMapa,
    h('div', { class: 'fila-campos' }, campo('Latitud', lat), campo('Longitud', lng)),
    boton,
    mensaje
  );
  const cerrar = abrirDialogo(centro ? 'Editar centro' : 'Nuevo centro de acopio', form);

  const inicio = centro ? [centro.lat, centro.lng] : [base.lat, base.lng];
  const mapa = L.map(miniMapa).setView(inicio, centro ? 16 : 13);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(mapa);
  const icono = L.divIcon({ className: 'pin pin--ninguna', iconSize: [24, 24], iconAnchor: [12, 12] });
  let marcador = centro ? L.marker(inicio, { icon: icono }).addTo(mapa) : null;
  setTimeout(() => mapa.invalidateSize(), 50);

  const fijar = (latlng) => {
    lat.value = latlng.lat.toFixed(6);
    lng.value = latlng.lng.toFixed(6);
    if (marcador) marcador.setLatLng(latlng);
    else marcador = L.marker(latlng, { icon: icono }).addTo(mapa);
  };
  mapa.on('click', (e) => fijar(e.latlng));
  const moverDesdeCampos = () => {
    const la = Number(lat.value);
    const ln = Number(lng.value);
    if (lat.value && lng.value && Math.abs(la) <= 90 && Math.abs(ln) <= 180) {
      fijar({ lat: la, lng: ln });
      mapa.setView([la, ln]);
    }
  };
  lat.addEventListener('change', moverDesdeCampos);
  lng.addEventListener('change', moverDesdeCampos);

  const dialogo = document.getElementById('dialogo');
  dialogo.addEventListener('close', () => mapa.remove(), { once: true });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!lat.value || !lng.value) {
      mostrarError(mensaje, new Error('Marca la ubicación del centro en el mapa.'));
      return;
    }
    const cuerpo = {
      nombre: nombre.value.trim(),
      direccion: direccion.value.trim(),
      horario: horario.value.trim() || undefined,
      lat: Number(lat.value),
      lng: Number(lng.value),
    };
    try {
      await conEspera(boton, 'Guardando…', () =>
        centro ? api(`/api/centros/${centro.id}`, { metodo: 'PATCH', cuerpo }) : api('/api/centros', { metodo: 'POST', cuerpo })
      );
      cerrar();
      avisar(centro ? 'Centro actualizado.' : 'Centro registrado. Ya aparece en el mapa.');
      alTerminar();
    } catch (err) {
      mostrarError(mensaje, err);
    }
  });
}

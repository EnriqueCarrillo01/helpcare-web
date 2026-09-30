import { api } from '../api.js';
import { suscribir } from '../tiempo-real.js';
import { abrirDonacion } from '../donar.js';
import {
  h, vaciar, avisar, selector, campo, TIPOS, URGENCIAS, formatoNumero, enlaceComoLlegar, errorCarga, vacio,
} from '../ui.js';

const RADIOS = { 5: '5 km', 10: '10 km', 25: '25 km', 50: '50 km', 100: '100 km' };

function textoNecesidad(n) {
  return `${n.titulo}: faltan ${formatoNumero(n.restante)} ${n.unidad}`;
}

export default async function vistaMapa(desk, [centroEnfocado]) {
  const L = window.L;
  const cfg = (window.HELPCARE_CONFIG && window.HELPCARE_CONFIG.mapaCentro) || { lat: 17.9892, lng: -92.9281, zoom: 13 };
  const estado = { origen: null, radioKm: '25', tipo: '', urgencia: '', primeraCarga: true };

  desk.classList.add('desk--mapa');

  // ---------- Controles ----------
  const botonUbicar = h('button', { type: 'button', class: 'secundario' }, 'Usar mi ubicación');
  const radio = selector('radio', RADIOS, { valor: estado.radioKm });
  // La distancia solo tiene sentido cuando se conoce la ubicación.
  const campoRadio = campo('Distancia', radio);
  campoRadio.hidden = true;
  const tipo = selector('tipo', TIPOS, { vacioTexto: 'Todos los tipos' });
  const urgencia = selector('urgencia', URGENCIAS, { vacioTexto: 'Cualquier urgencia' });

  const resumen = h('p', { class: 'centros-resumen', 'aria-live': 'polite' });
  const lista = h('ol', { class: 'centros-lista' });
  const contMapa = h('div', { class: 'mapa', role: 'region', 'aria-label': 'Mapa de centros de acopio' });

  const leyenda = h(
    'ul',
    { class: 'leyenda', 'aria-label': 'Leyenda de urgencia' },
    ['critica', 'media', 'baja', 'ninguna'].map((u) =>
      h('li', {}, h('span', { class: `leyenda-punto pin--${u}`, 'aria-hidden': 'true' }), u === 'ninguna' ? 'Sin necesidades abiertas' : `Urgencia ${URGENCIAS[u].toLowerCase()}`)
    )
  );

  desk.append(
    h(
      'div',
      { class: 'mapa-vista' },
      contMapa,
      h(
        'section',
        { class: 'mapa-panel', 'aria-label': 'Lista de centros' },
        h('h1', {}, 'Centros de acopio'),
        h('p', { class: 'view-intro' }, 'Encuentra dónde entregar ayuda y qué hace falta en cada lugar.'),
        h(
          'div',
          { class: 'filtros' },
          botonUbicar,
          campoRadio,
          campo('Tipo de ayuda', tipo),
          campo('Urgencia', urgencia)
        ),
        leyenda,
        resumen,
        lista
      )
    )
  );

  // ---------- Mapa ----------
  const mapa = L.map(contMapa, { zoomControl: true }).setView([cfg.lat, cfg.lng], cfg.zoom);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(mapa);

  const grupo = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 40,
    iconCreateFunction: (cluster) =>
      L.divIcon({
        className: 'grupo-pin',
        html: h('span', {}, String(cluster.getChildCount())),
        iconSize: [36, 36],
      }),
  });
  mapa.addLayer(grupo);
  requestAnimationFrame(() => mapa.invalidateSize());

  const marcadores = new Map();
  let capaOrigen = null;

  function contenidoPopup(c) {
    return h(
      'div',
      { class: 'popup' },
      h('h2', {}, c.nombre),
      c.institucion ? h('p', { class: 'popup-meta' }, c.institucion.nombre) : null,
      h('p', { class: 'popup-meta' }, c.direccion),
      c.horario ? h('p', { class: 'popup-meta' }, c.horario) : null,
      c.necesidades.length
        ? h(
            'ul',
            { class: 'popup-necesidades' },
            c.necesidades.map((n) =>
              h(
                'li',
                {},
                h('span', { class: `punto pin--${n.urgencia}`, 'aria-hidden': 'true' }),
                h('a', { href: `#/necesidad/${n.id}` }, textoNecesidad(n)),
                n.restante > 0
                  ? h('button', { type: 'button', class: 'mini', onclick: () => abrirDonacion(n, c, cargar) }, 'Donar')
                  : null
              )
            )
          )
        : h('p', { class: 'popup-meta' }, 'Sin necesidades abiertas por ahora.'),
      enlaceComoLlegar(c)
    );
  }

  function enfocar(id) {
    const m = marcadores.get(Number(id));
    if (!m) return;
    grupo.zoomToShowLayer(m, () => m.openPopup());
  }

  function itemLista(c) {
    const visibles = c.necesidades.slice(0, 3);
    return h(
      'li',
      { class: 'centro-item' },
      h(
        'div',
        { class: 'centro-cabecera' },
        h('span', { class: `punto pin--${c.urgenciaMaxima || 'ninguna'}`, 'aria-hidden': 'true' }),
        h('button', { type: 'button', class: 'centro-nombre', onclick: () => enfocar(c.id) }, c.nombre),
        c.distanciaKm !== null ? h('span', { class: 'centro-distancia' }, `${c.distanciaKm} km`) : null
      ),
      h('p', { class: 'centro-meta' }, [c.institucion && c.institucion.nombre, c.direccion].filter(Boolean).join(' · ')),
      visibles.length
        ? h(
            'ul',
            { class: 'centro-necesidades' },
            visibles.map((n) =>
              h(
                'li',
                {},
                h('a', { href: `#/necesidad/${n.id}` }, textoNecesidad(n)),
                n.restante > 0
                  ? h('button', { type: 'button', class: 'mini', onclick: () => abrirDonacion(n, c, cargar) }, 'Donar')
                  : null
              )
            ),
            c.necesidades.length > 3
              ? h('li', { class: 'centro-mas' }, h('button', { type: 'button', class: 'enlace-boton', onclick: () => enfocar(c.id) }, `Ver ${c.necesidades.length - 3} más en el mapa`))
              : null
          )
        : h('p', { class: 'centro-meta' }, 'Sin necesidades abiertas por ahora.')
    );
  }

  function pintar(centros) {
    grupo.clearLayers();
    marcadores.clear();
    const puntos = [];
    for (const c of centros) {
      const u = c.urgenciaMaxima || 'ninguna';
      const marcador = L.marker([c.lat, c.lng], {
        title: c.nombre,
        alt: c.nombre,
        keyboard: true,
        icon: L.divIcon({
          className: `pin pin--${u}`,
          html: h('span', {}, c.necesidades.length ? String(c.necesidades.length) : ''),
          iconSize: [30, 30],
          iconAnchor: [15, 15],
          popupAnchor: [0, -12],
        }),
      });
      marcador.bindPopup(() => contenidoPopup(c), { maxWidth: 300 });
      grupo.addLayer(marcador);
      marcadores.set(c.id, marcador);
      puntos.push([c.lat, c.lng]);
    }

    const criticos = centros.filter((c) => c.urgenciaMaxima === 'critica').length;
    const cerca = estado.origen ? ` en ${RADIOS[estado.radioKm]} a la redonda` : '';
    resumen.textContent = centros.length
      ? `${centros.length} ${centros.length === 1 ? 'centro' : 'centros'}${cerca}${criticos ? `, ${criticos} con necesidades críticas` : ''}.`
      : '';

    if (centros.length === 0) {
      const hayFiltros = estado.tipo || estado.urgencia || estado.origen;
      vaciar(
        lista,
        vacio(
          hayFiltros ? 'No hay centros que coincidan. Amplía la distancia o quita filtros.' : 'Todavía no hay centros de acopio registrados.',
          hayFiltros
            ? h('button', { type: 'button', class: 'secundario', onclick: quitarFiltros }, 'Quitar filtros')
            : h('a', { class: 'secundario', href: '#/registro' }, 'Registrar una institución')
        )
      );
    } else {
      vaciar(lista, centros.map(itemLista));
    }

    if (estado.primeraCarga && puntos.length && !estado.origen) {
      mapa.fitBounds(puntos, { padding: [40, 40], maxZoom: 14 });
    }
    if (estado.primeraCarga && centroEnfocado) enfocar(centroEnfocado);
    estado.primeraCarga = false;
  }

  async function cargar() {
    resumen.textContent = 'Buscando centros…';
    try {
      const centros = await api('/api/centros', {
        query: {
          lat: estado.origen && estado.origen.lat,
          lng: estado.origen && estado.origen.lng,
          radioKm: estado.origen ? estado.radioKm : undefined,
          tipo: estado.tipo,
          urgencia: estado.urgencia,
        },
      });
      pintar(centros);
    } catch (err) {
      resumen.textContent = '';
      vaciar(lista, errorCarga(err, cargar));
    }
  }

  function quitarFiltros() {
    estado.tipo = '';
    estado.urgencia = '';
    tipo.value = '';
    urgencia.value = '';
    if (estado.origen) {
      estado.radioKm = '100';
      radio.value = '100';
      dibujarOrigen();
    }
    cargar();
  }

  function dibujarOrigen() {
    if (capaOrigen) capaOrigen.remove();
    const { lat, lng } = estado.origen;
    capaOrigen = L.layerGroup([
      L.circle([lat, lng], { radius: Number(estado.radioKm) * 1000, className: 'radio-busqueda', interactive: false }),
      L.circleMarker([lat, lng], { radius: 7, className: 'yo', interactive: false }),
    ]).addTo(mapa);
    mapa.fitBounds(capaOrigen.getLayers()[0].getBounds(), { padding: [20, 20] });
  }

  botonUbicar.addEventListener('click', () => {
    if (!window.isSecureContext || !navigator.geolocation) {
      avisar('Tu navegador solo comparte la ubicación en sitios https o en localhost.', 'error');
      return;
    }
    botonUbicar.disabled = true;
    botonUbicar.textContent = 'Buscando tu ubicación…';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        estado.origen = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        campoRadio.hidden = false;
        botonUbicar.disabled = false;
        botonUbicar.textContent = 'Actualizar mi ubicación';
        dibujarOrigen();
        cargar();
      },
      (err) => {
        botonUbicar.disabled = false;
        botonUbicar.textContent = 'Usar mi ubicación';
        avisar(
          err.code === 1
            ? 'No diste permiso de ubicación. El mapa sigue mostrando todos los centros.'
            : 'No se pudo obtener tu ubicación. Intenta de nuevo.',
          'error'
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  });

  radio.addEventListener('change', () => {
    estado.radioKm = radio.value;
    dibujarOrigen();
    cargar();
  });
  tipo.addEventListener('change', () => {
    estado.tipo = tipo.value;
    cargar();
  });
  urgencia.addEventListener('change', () => {
    estado.urgencia = urgencia.value;
    cargar();
  });

  await cargar();
  const desuscribir = suscribir(() => cargar());

  return () => {
    desuscribir();
    mapa.remove();
  };
}

// Utilidades de interfaz. h() construye elementos del DOM: todo texto se
// inserta con textContent, así ningún dato del servidor se interpreta como HTML.

export function h(etiqueta, atributos = {}, ...hijos) {
  const el = document.createElement(etiqueta);
  for (const [clave, valor] of Object.entries(atributos || {})) {
    if (valor === undefined || valor === null || valor === false) continue;
    if (clave.startsWith('on') && typeof valor === 'function') {
      el.addEventListener(clave.slice(2), valor);
    } else if (clave === 'class') {
      el.className = valor;
    } else if (clave === 'dataset') {
      Object.assign(el.dataset, valor);
    } else if (valor === true) {
      el.setAttribute(clave, '');
    } else {
      el.setAttribute(clave, String(valor));
    }
  }
  agregar(el, hijos);
  return el;
}

function agregar(el, hijos) {
  for (const hijo of hijos.flat(Infinity)) {
    if (hijo === null || hijo === undefined || hijo === false) continue;
    el.append(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)));
  }
}

export function vaciar(el, ...hijos) {
  el.replaceChildren();
  agregar(el, hijos);
  return el;
}

// ---------- Etiquetas legibles ----------
export const TIPOS = {
  alimentos: 'Alimentos',
  agua: 'Agua',
  ropa: 'Ropa',
  higiene: 'Higiene',
  medicinas: 'Medicinas',
  servicios_medicos: 'Servicios médicos',
  voluntariado: 'Voluntariado',
  otro: 'Otro',
};
export const URGENCIAS = { critica: 'Crítica', media: 'Media', baja: 'Baja' };
export const ESTADOS_NECESIDAD = {
  pendiente: 'En revisión',
  abierta: 'Abierta',
  cubierta: 'Cubierta',
  rechazada: 'Rechazada',
  cerrada: 'Cerrada',
};
export const ESTADOS_DONACION = {
  comprometida: 'Comprometida',
  en_camino: 'En camino',
  entregada: 'Entregada',
  cancelada: 'Cancelada',
};
export const ESTADOS_CUENTA = { activo: 'Activa', pendiente: 'En revisión', rechazado: 'Rechazada' };
export const ROLES = { donante: 'Donante', institucion: 'Institución', administrador: 'Administración' };

export const urgenciaChip = (u) =>
  h('span', { class: `urgencia urgencia--${u}` }, `Urgencia ${URGENCIAS[u].toLowerCase()}`);
export const estadoChip = (texto, variante) => h('span', { class: `estado estado--${variante}` }, texto);

const numero = new Intl.NumberFormat('es-MX');
export const formatoNumero = (n) => numero.format(n);
const fecha = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const formatoFecha = (iso) => fecha.format(new Date(iso));

// Barra de avance: entregado (sólido) y comprometido (claro) sobre lo requerido.
export function avance(n) {
  const pct = (x) => `${Math.min(100, Math.round((x / n.cantidadRequerida) * 100))}%`;
  const barra = h('div', {
    class: 'avance',
    role: 'img',
    'aria-label': `${n.cantidadEntregada} entregadas y ${n.cantidadComprometida} comprometidas de ${n.cantidadRequerida} ${n.unidad}`,
  });
  const comprometido = h('span', { class: 'avance-comprometido' });
  const entregado = h('span', { class: 'avance-entregado' });
  comprometido.style.width = pct(n.cantidadComprometida);
  entregado.style.width = pct(n.cantidadEntregada);
  barra.append(comprometido, entregado);
  return h(
    'div',
    { class: 'avance-bloque' },
    barra,
    h(
      'p',
      { class: 'avance-texto' },
      n.restante > 0
        ? `Faltan ${formatoNumero(n.restante)} de ${formatoNumero(n.cantidadRequerida)} ${n.unidad}`
        : `Completa: ${formatoNumero(n.cantidadRequerida)} ${n.unidad} comprometidas`,
      n.cantidadEntregada > 0 ? ` · ${formatoNumero(n.cantidadEntregada)} ya entregadas` : ''
    )
  );
}

export function enlaceComoLlegar(centro) {
  const destino = `${centro.lat},${centro.lng}`;
  return h(
    'a',
    {
      class: 'enlace',
      href: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}`,
      target: '_blank',
      rel: 'noopener noreferrer',
    },
    'Cómo llegar'
  );
}

// ---------- Avisos breves ----------
export function avisar(mensaje, tipo = 'ok') {
  const zona = document.getElementById('avisos');
  const aviso = h('p', { class: `aviso aviso--${tipo}` }, mensaje);
  // Como máximo tres avisos a la vez: el más antiguo se retira.
  while (zona.childElementCount >= 3) zona.firstElementChild.remove();
  zona.append(aviso);
  setTimeout(() => aviso.remove(), tipo === 'error' ? 7000 : 4000);
}

// Deshabilita el botón mientras corre la acción, para evitar envíos dobles.
export async function conEspera(boton, textoEspera, accion) {
  const original = boton.textContent;
  boton.disabled = true;
  boton.textContent = textoEspera;
  try {
    return await accion();
  } finally {
    boton.disabled = false;
    boton.textContent = original;
  }
}

export function mensajeFormulario() {
  return h('p', { class: 'form-feedback', role: 'alert' });
}

export function mostrarError(el, err) {
  el.className = 'form-feedback is-error';
  el.textContent = err.message;
}

export function mostrarExito(el, texto) {
  el.className = 'form-feedback is-success';
  el.textContent = texto;
}

export const cargando = (texto = 'Cargando…') => h('p', { class: 'cargando' }, texto);
export const vacio = (texto, accion) => h('div', { class: 'vacio' }, h('p', {}, texto), accion || null);
export const errorCarga = (err, reintentar) =>
  h(
    'div',
    { class: 'vacio vacio--error' },
    h('p', {}, err.message),
    reintentar ? h('button', { type: 'button', class: 'secundario', onclick: reintentar }, 'Reintentar') : null
  );

// Campo de formulario con etiqueta asociada.
let idCampo = 0;
export function campo(etiqueta, control, ayuda) {
  const id = control.id || `campo-${++idCampo}`;
  control.id = id;
  return h(
    'div',
    { class: 'campo' },
    h('label', { for: id }, etiqueta),
    control,
    ayuda ? h('p', { class: 'field-hint' }, ayuda) : null
  );
}

export function selector(nombre, opciones, { vacioTexto, valor } = {}) {
  const sel = h('select', { name: nombre });
  if (vacioTexto) sel.append(h('option', { value: '' }, vacioTexto));
  Object.entries(opciones).forEach(([v, t]) => sel.append(h('option', { value: v, selected: v === valor }, t)));
  return sel;
}

// Diálogo modal nativo (<dialog>): accesible y cerrable con Esc.
export function abrirDialogo(titulo, contenido) {
  const dialogo = document.getElementById('dialogo');
  const cerrar = () => dialogo.close();
  vaciar(
    dialogo,
    h(
      'div',
      { class: 'dialogo-cabecera' },
      h('h2', {}, titulo),
      h('button', { type: 'button', class: 'dialogo-cerrar', 'aria-label': 'Cerrar', onclick: cerrar }, '×')
    ),
    contenido
  );
  dialogo.showModal();
  return cerrar;
}

export function paginador({ pagina, porPagina, total }, irA) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  if (paginas <= 1) return null;
  return h(
    'nav',
    { class: 'paginador', 'aria-label': 'Paginación' },
    h('button', { type: 'button', class: 'secundario', disabled: pagina <= 1, onclick: () => irA(pagina - 1) }, 'Anterior'),
    h('span', {}, `Página ${pagina} de ${paginas}`),
    h('button', { type: 'button', class: 'secundario', disabled: pagina >= paginas, onclick: () => irA(pagina + 1) }, 'Siguiente')
  );
}

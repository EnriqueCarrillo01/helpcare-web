import { h, vaciar } from '../ui.js';

// Pestañas accesibles (role="tablist"). Cada pestaña es una función que pinta
// su contenido en el panel y puede devolver una función de limpieza.
export function pestanas(contenedor, definiciones) {
  const panel = h('div', { class: 'pestana-panel', role: 'tabpanel', tabindex: '0' });
  let limpiar = null;
  const botones = definiciones.map((d, i) =>
    h('button', { type: 'button', role: 'tab', class: 'pestana', id: `pestana-${i}`, onclick: () => activar(i) }, d.titulo)
  );
  const barra = h('div', { class: 'pestanas', role: 'tablist' }, botones);

  barra.addEventListener('keydown', (e) => {
    const actual = botones.indexOf(document.activeElement);
    if (actual < 0 || !['ArrowRight', 'ArrowLeft'].includes(e.key)) return;
    const siguiente = (actual + (e.key === 'ArrowRight' ? 1 : -1) + botones.length) % botones.length;
    botones[siguiente].focus();
    activar(siguiente);
  });

  async function activar(i) {
    if (limpiar) limpiar();
    limpiar = null;
    botones.forEach((b, j) => {
      b.setAttribute('aria-selected', String(i === j));
      b.tabIndex = i === j ? 0 : -1;
    });
    panel.setAttribute('aria-labelledby', `pestana-${i}`);
    vaciar(panel);
    const r = await definiciones[i].pintar(panel);
    if (typeof r === 'function') limpiar = r;
  }

  contenedor.append(barra, panel);
  activar(0);
  return () => {
    if (limpiar) limpiar();
  };
}

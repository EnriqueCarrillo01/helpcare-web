import { api } from './api.js';
import { usuarioActual } from './sesion.js';
import { recordarDestino } from './navegacion.js';
import { h, abrirDialogo, campo, avisar, conEspera, mensajeFormulario, mostrarError, formatoNumero } from './ui.js';

// Diálogo para comprometer una donación a una necesidad.
export function abrirDonacion(necesidad, centro, alTerminar) {
  const usuario = usuarioActual();

  if (!usuario) {
    recordarDestino();
    abrirDialogo(
      'Inicia sesión para donar',
      h(
        'div',
        { class: 'dialogo-cuerpo' },
        h('p', {}, 'Tu cuenta sirve para avisarle al centro qué vas a llevar y darle seguimiento a tu entrega.'),
        h(
          'div',
          { class: 'acciones' },
          h('a', { class: 'primary-button', href: '#/login', onclick: () => document.getElementById('dialogo').close() }, 'Iniciar sesión'),
          h('a', { class: 'secundario', href: '#/registro', onclick: () => document.getElementById('dialogo').close() }, 'Crear cuenta')
        )
      )
    );
    return;
  }

  if (usuario.rol !== 'donante') {
    abrirDialogo(
      'Donaciones desde una cuenta de donante',
      h('div', { class: 'dialogo-cuerpo' }, h('p', {}, 'Las cuentas de institución y de administración no pueden comprometer donaciones. Crea una cuenta de donante para hacerlo.'))
    );
    return;
  }

  const cantidad = h('input', { type: 'number', name: 'cantidad', min: 1, max: necesidad.restante, step: 1, required: true, value: Math.min(necesidad.restante, 1) });
  const nota = h('textarea', { name: 'nota', rows: 3, maxlength: 300, placeholder: 'Ej.: Llevo la donación el sábado por la mañana' });
  const mensaje = mensajeFormulario();
  const boton = h('button', { type: 'submit', class: 'primary-button' }, 'Confirmar compromiso');

  const form = h(
    'form',
    { class: 'desk-form dialogo-cuerpo', novalidate: true },
    h('p', { class: 'dialogo-contexto' }, `${necesidad.titulo} · ${centro ? centro.nombre : ''}`),
    h('p', {}, `Faltan ${formatoNumero(necesidad.restante)} ${necesidad.unidad}. Comprométete solo con lo que puedas entregar: el centro contará con ello.`),
    campo(`Cantidad (${necesidad.unidad})`, cantidad),
    campo('Nota para el centro (opcional)', nota),
    boton,
    mensaje
  );

  const cerrar = abrirDialogo('Comprometer donación', form);
  cantidad.focus();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const n = Number(cantidad.value);
    if (!Number.isInteger(n) || n < 1 || n > necesidad.restante) {
      mostrarError(mensaje, new Error(`Escribe un número entero entre 1 y ${necesidad.restante}.`));
      return;
    }
    try {
      await conEspera(boton, 'Guardando…', () =>
        api('/api/donaciones', { metodo: 'POST', cuerpo: { necesidadId: necesidad.id, cantidad: n, nota: nota.value.trim() || undefined } })
      );
      cerrar();
      avisar('Donación comprometida. Encuéntrala en "Mis donaciones".');
      if (alTerminar) alTerminar();
    } catch (err) {
      mostrarError(mensaje, err);
    }
  });
}

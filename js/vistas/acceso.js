import { api } from '../api.js';
import { guardarSesion } from '../sesion.js';
import { irTrasIniciarSesion } from '../navegacion.js';
import { h, campo, conEspera, mensajeFormulario, mostrarError, avisar } from '../ui.js';

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function vistaRegistro(desk) {
  const nombre = h('input', { type: 'text', name: 'nombre', autocomplete: 'name', required: true, minlength: 2, maxlength: 100 });
  const email = h('input', { type: 'email', name: 'email', autocomplete: 'email', required: true });
  const organizacion = h('input', { type: 'text', name: 'organizacion', autocomplete: 'organization', maxlength: 150 });
  const password = h('input', { type: 'password', name: 'password', autocomplete: 'new-password', required: true, minlength: 8, maxlength: 72 });
  const confirmar = h('input', { type: 'password', name: 'confirmar', autocomplete: 'new-password', required: true });
  const mensaje = mensajeFormulario();
  const boton = h('button', { type: 'submit', class: 'primary-button' }, 'Crear cuenta');

  const opcionTipo = (valor, titulo, texto, marcado) =>
    h(
      'label',
      { class: 'opcion-tarjeta' },
      h('input', { type: 'radio', name: 'rol', value: valor, checked: marcado }),
      h('span', {}, h('strong', {}, titulo), h('span', { class: 'field-hint' }, texto))
    );

  const campoOrganizacion = campo('Nombre de la organización', organizacion, 'Revisaremos los datos antes de que puedas publicar centros y necesidades.');
  campoOrganizacion.hidden = true;

  const form = h(
    'form',
    { class: 'desk-form', novalidate: true },
    h(
      'fieldset',
      { class: 'tipo-cuenta' },
      h('legend', {}, 'Tipo de cuenta'),
      opcionTipo('donante', 'Quiero donar', 'Compromete donaciones y da seguimiento a tus entregas.', true),
      opcionTipo('institucion', 'Represento una institución', 'Publica centros de acopio y lo que necesitan.', false)
    ),
    campo('Tu nombre', nombre),
    campoOrganizacion,
    campo('Correo electrónico', email),
    campo('Contraseña', password, 'Entre 8 y 72 caracteres.'),
    campo('Confirma la contraseña', confirmar),
    boton,
    mensaje
  );

  form.addEventListener('change', (e) => {
    if (e.target.name === 'rol') {
      const esInstitucion = e.target.value === 'institucion';
      campoOrganizacion.hidden = !esInstitucion;
      organizacion.required = esInstitucion;
      boton.textContent = esInstitucion ? 'Enviar registro para revisión' : 'Crear cuenta';
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const rol = form.elements.rol.value;
    const errores = [];
    if (nombre.value.trim().length < 2) errores.push('Escribe tu nombre (mínimo 2 caracteres)');
    if (rol === 'institucion' && organizacion.value.trim().length < 2) errores.push('Escribe el nombre de la organización');
    if (!REGEX_EMAIL.test(email.value.trim())) errores.push('Escribe un correo válido');
    if (password.value.length < 8) errores.push('La contraseña debe tener al menos 8 caracteres');
    if (new TextEncoder().encode(password.value).length > 72) errores.push('La contraseña admite máximo 72 caracteres');
    if (password.value !== confirmar.value) errores.push('Las contraseñas no coinciden');
    if (errores.length) {
      mostrarError(mensaje, new Error(errores.join('. ')));
      return;
    }
    try {
      const datos = await conEspera(boton, 'Creando cuenta…', () =>
        api('/api/auth/registro', {
          metodo: 'POST',
          cuerpo: {
            nombre: nombre.value.trim(),
            email: email.value.trim(),
            password: password.value,
            rol,
            organizacion: rol === 'institucion' ? organizacion.value.trim() : undefined,
          },
        })
      );
      guardarSesion(datos.token, datos.usuario);
      avisar(rol === 'institucion' ? 'Registro enviado. Te avisaremos aquí cuando se apruebe.' : 'Cuenta creada. ¡Bienvenida, bienvenido!');
      irTrasIniciarSesion();
    } catch (err) {
      mostrarError(mensaje, err);
    }
  });

  desk.append(
    h(
      'section',
      { class: 'view' },
      h('h1', {}, 'Crea tu cuenta'),
      h('p', { class: 'view-intro' }, '¿Ya tienes cuenta? ', h('a', { class: 'enlace', href: '#/login' }, 'Inicia sesión')),
      form
    )
  );
}

export function vistaLogin(desk) {
  const email = h('input', { type: 'email', name: 'email', autocomplete: 'email', required: true });
  const password = h('input', { type: 'password', name: 'password', autocomplete: 'current-password', required: true });
  const mensaje = mensajeFormulario();
  const boton = h('button', { type: 'submit', class: 'primary-button' }, 'Iniciar sesión');

  const form = h('form', { class: 'desk-form', novalidate: true }, campo('Correo electrónico', email), campo('Contraseña', password), boton, mensaje);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!email.value.trim() || !password.value) {
      mostrarError(mensaje, new Error('Escribe tu correo y tu contraseña.'));
      return;
    }
    try {
      const datos = await conEspera(boton, 'Entrando…', () =>
        api('/api/auth/login', { metodo: 'POST', cuerpo: { email: email.value.trim(), password: password.value } })
      );
      guardarSesion(datos.token, datos.usuario);
      irTrasIniciarSesion();
    } catch (err) {
      mostrarError(mensaje, err);
      password.value = '';
    }
  });

  desk.append(
    h(
      'section',
      { class: 'view' },
      h('h1', {}, 'Inicia sesión'),
      h('p', { class: 'view-intro' }, '¿Aún no tienes cuenta? ', h('a', { class: 'enlace', href: '#/registro' }, 'Créala aquí')),
      form
    )
  );
  email.focus();
}

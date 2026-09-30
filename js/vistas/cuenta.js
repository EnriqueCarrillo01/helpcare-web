import { api } from '../api.js';
import { actualizarUsuario, usuarioActual } from '../sesion.js';
import { h, vaciar, ROLES, ESTADOS_CUENTA, cargando, errorCarga } from '../ui.js';

const SIGUIENTE = {
  donante: { href: '#/mis-donaciones', texto: 'Ver mis donaciones', alterna: { href: '#/mapa', texto: 'Buscar dónde donar' } },
  institucion: { href: '#/institucion', texto: 'Ir a mi institución' },
  administrador: { href: '#/admin', texto: 'Revisar pendientes' },
};

export default async function vistaCuenta(desk) {
  const vista = h('section', { class: 'view' }, cargando());
  desk.append(vista);

  try {
    // Se consulta el perfil para reflejar cambios recientes (p. ej. una aprobación).
    const u = await api('/api/usuarios/perfil');
    actualizarUsuario(u);
    const sig = SIGUIENTE[u.rol];
    vaciar(
      vista,
      h('h1', {}, u.nombre),
      u.rol === 'institucion' && u.estado === 'pendiente'
        ? h(
            'p',
            { class: 'nota-estado' },
            'Tu institución está en revisión. En cuanto un administrador la apruebe podrás registrar centros de acopio y publicar necesidades.'
          )
        : null,
      h(
        'dl',
        { class: 'record' },
        fila('Correo', u.email),
        u.organizacion ? fila('Organización', u.organizacion) : null,
        fila('Tipo de cuenta', h('span', { class: 'role-chip' }, ROLES[u.rol])),
        fila('Estado', ESTADOS_CUENTA[u.estado])
      ),
      h(
        'p',
        { class: 'acciones' },
        sig && !(u.rol === 'institucion' && u.estado !== 'activo') ? h('a', { class: 'primary-button', href: sig.href }, sig.texto) : null,
        sig && sig.alterna ? h('a', { class: 'secundario', href: sig.alterna.href }, sig.alterna.texto) : null
      )
    );
  } catch (err) {
    const u = usuarioActual();
    vaciar(vista, h('h1', {}, u ? u.nombre : 'Mi cuenta'), errorCarga(err, () => location.reload()));
  }
}

function fila(dt, dd) {
  return h('div', { class: 'record-row' }, h('dt', {}, dt), h('dd', {}, dd));
}

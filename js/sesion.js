// Sesión guardada en el navegador. El token vive en localStorage: todo el
// contenido que viene del servidor se inserta como texto (nunca como HTML) y la
// CSP bloquea scripts externos, que es lo que protege al token de un XSS.
const CLAVES = { token: 'helpcare_token', usuario: 'helpcare_usuario' };
const oyentes = new Set();

function leer(clave) {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

export function obtenerSesion() {
  const token = leer(CLAVES.token);
  const crudo = leer(CLAVES.usuario);
  if (!token || !crudo) return null;
  try {
    return { token, usuario: JSON.parse(crudo) };
  } catch {
    return null;
  }
}

export function usuarioActual() {
  const s = obtenerSesion();
  return s ? s.usuario : null;
}

function avisar() {
  const s = obtenerSesion();
  oyentes.forEach((fn) => fn(s));
}

export function guardarSesion(token, usuario) {
  localStorage.setItem(CLAVES.token, token);
  localStorage.setItem(CLAVES.usuario, JSON.stringify(usuario));
  avisar();
}

// Actualiza los datos del usuario (p. ej. cuando un admin aprueba la institución).
export function actualizarUsuario(usuario) {
  if (!obtenerSesion()) return;
  localStorage.setItem(CLAVES.usuario, JSON.stringify(usuario));
  avisar();
}

export function cerrarSesion() {
  localStorage.removeItem(CLAVES.token);
  localStorage.removeItem(CLAVES.usuario);
  avisar();
}

export function alCambiarSesion(fn) {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}

// Otra pestaña cerró o abrió sesión.
window.addEventListener('storage', (e) => {
  if (e.key === CLAVES.token || e.key === CLAVES.usuario) avisar();
});

// ---------- Estado y almacenamiento local ----------

const STORAGE_KEYS = {
  token: 'helpcare_token',
  usuario: 'helpcare_usuario',
  apiBase: 'helpcare_api_base',
};

function getApiBase() {
  return localStorage.getItem(STORAGE_KEYS.apiBase) || 'http://localhost:3000';
}

function setApiBase(value) {
  localStorage.setItem(STORAGE_KEYS.apiBase, value);
}

function getSesion() {
  const token = localStorage.getItem(STORAGE_KEYS.token);
  const usuarioRaw = localStorage.getItem(STORAGE_KEYS.usuario);
  if (!token || !usuarioRaw) return null;
  try {
    return { token, usuario: JSON.parse(usuarioRaw) };
  } catch (err) {
    return null;
  }
}

function guardarSesion(token, usuario) {
  localStorage.setItem(STORAGE_KEYS.token, token);
  localStorage.setItem(STORAGE_KEYS.usuario, JSON.stringify(usuario));
}

function limpiarSesion() {
  localStorage.removeItem(STORAGE_KEYS.token);
  localStorage.removeItem(STORAGE_KEYS.usuario);
}

// ---------- Llamadas a la API ----------

async function apiFetch(path, options = {}) {
  const base = getApiBase().replace(/\/$/, '');
  const sesion = getSesion();

  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (sesion) {
    headers.Authorization = `Bearer ${sesion.token}`;
  }

  const res = await fetch(`${base}${path}`, { ...options, headers });
  let data = null;
  try {
    data = await res.json();
  } catch (err) {
    data = null;
  }

  if (!res.ok) {
    const mensaje =
      (data && data.error) ||
      (data && data.errores && data.errores.join(' ')) ||
      `Error ${res.status}`;
    throw new Error(mensaje);
  }

  return data;
}

// ---------- Navegación entre vistas ----------

const vistas = ['registro', 'login', 'perfil', 'admin'];

function mostrarVista(nombre) {
  vistas.forEach((v) => {
    document.getElementById(`view-${v}`).hidden = v !== nombre;
  });
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.view === nombre);
  });

  if (nombre === 'perfil') cargarPerfil();
  if (nombre === 'admin') cargarAdmin();
}

document.querySelectorAll('.nav-item').forEach((btn) => {
  btn.addEventListener('click', () => mostrarVista(btn.dataset.view));
});

// ---------- Estado de sesión en la barra lateral ----------

function actualizarBarraSesion() {
  const sesion = getSesion();
  const statusEl = document.getElementById('session-status');
  const logoutBtn = document.getElementById('logout-button');
  const navAdmin = document.getElementById('nav-admin');

  if (sesion) {
    statusEl.textContent = `${sesion.usuario.nombre} · ${sesion.usuario.rol}`;
    logoutBtn.hidden = false;
    navAdmin.hidden = sesion.usuario.rol !== 'administrador';
  } else {
    statusEl.textContent = 'Sin iniciar sesión';
    logoutBtn.hidden = true;
    navAdmin.hidden = true;
  }
}

document.getElementById('logout-button').addEventListener('click', () => {
  limpiarSesion();
  actualizarBarraSesion();
  mostrarVista('login');
});

// ---------- Configuración de la URL del backend ----------

const apiInput = document.getElementById('api-base');
apiInput.value = getApiBase();
apiInput.addEventListener('change', () => {
  setApiBase(apiInput.value.trim() || 'http://localhost:3000');
});

// ---------- Formulario de registro ----------

document.getElementById('form-registro').addEventListener('submit', async (e) => {
  e.preventDefault();
  const feedback = document.getElementById('registro-feedback');
  feedback.textContent = '';
  feedback.className = 'form-feedback';

  const nombre = document.getElementById('registro-nombre').value.trim();
  const email = document.getElementById('registro-email').value.trim();
  const password = document.getElementById('registro-password').value;

  try {
    const data = await apiFetch('/api/auth/registro', {
      method: 'POST',
      body: JSON.stringify({ nombre, email, password }),
    });
    guardarSesion(data.token, data.usuario);
    actualizarBarraSesion();
    feedback.textContent = 'Cuenta creada. Redirigiendo a tu perfil…';
    feedback.classList.add('is-success');
    setTimeout(() => mostrarVista('perfil'), 600);
  } catch (err) {
    feedback.textContent = err.message;
    feedback.classList.add('is-error');
  }
});

// ---------- Formulario de login ----------

document.getElementById('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const feedback = document.getElementById('login-feedback');
  feedback.textContent = '';
  feedback.className = 'form-feedback';

  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  try {
    const data = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    guardarSesion(data.token, data.usuario);
    actualizarBarraSesion();
    feedback.textContent = 'Sesión iniciada. Redirigiendo a tu perfil…';
    feedback.classList.add('is-success');
    setTimeout(() => mostrarVista('perfil'), 500);
  } catch (err) {
    feedback.textContent = err.message;
    feedback.classList.add('is-error');
  }
});

// ---------- Vista de perfil ----------

async function cargarPerfil() {
  const record = document.getElementById('perfil-record');
  const feedback = document.getElementById('perfil-feedback');
  feedback.textContent = '';
  feedback.className = 'form-feedback';

  const sesion = getSesion();
  if (!sesion) {
    record.innerHTML = '<p class="record-empty">Inicia sesión para ver tu información.</p>';
    return;
  }

  try {
    const usuario = await apiFetch('/api/donantes/perfil');
    record.innerHTML = `
      <dl>
        <div class="record-row"><dt>Nombre</dt><dd>${escaparHtml(usuario.nombre)}</dd></div>
        <div class="record-row"><dt>Correo</dt><dd>${escaparHtml(usuario.email)}</dd></div>
        <div class="record-row"><dt>Rol</dt><dd><span class="role-chip">${escaparHtml(usuario.rol)}</span></dd></div>
      </dl>
    `;
  } catch (err) {
    record.innerHTML = '<p class="record-empty">No se pudo cargar tu perfil.</p>';
    feedback.textContent = err.message;
    feedback.classList.add('is-error');
  }
}

// ---------- Panel de administración ----------

async function cargarAdmin() {
  const table = document.getElementById('admin-table');
  const body = document.getElementById('admin-table-body');
  const feedback = document.getElementById('admin-feedback');
  feedback.textContent = '';
  feedback.className = 'form-feedback';
  table.hidden = true;
  body.innerHTML = '';

  try {
    const donantes = await apiFetch('/api/donantes');
    body.innerHTML = donantes
      .map(
        (d) => `
        <tr>
          <td>${escaparHtml(d.nombre)}</td>
          <td>${escaparHtml(d.email)}</td>
          <td>${escaparHtml(d.rol)}</td>
        </tr>`
      )
      .join('');
    table.hidden = false;
  } catch (err) {
    feedback.textContent = err.message;
    feedback.classList.add('is-error');
  }
}

// ---------- Utilidad ----------

function escaparHtml(texto) {
  const div = document.createElement('div');
  div.textContent = String(texto);
  return div.innerHTML;
}

// ---------- Arranque ----------

actualizarBarraSesion();
mostrarVista(getSesion() ? 'perfil' : 'registro');

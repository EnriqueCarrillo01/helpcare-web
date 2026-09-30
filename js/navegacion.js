export function navegar(ruta) {
  location.hash = `#/${ruta}`;
}

// Recuerda qué página se intentaba abrir antes de pedir inicio de sesión.
export function recordarDestino() {
  sessionStorage.setItem('helpcare_volver', location.hash);
}

export function irTrasIniciarSesion() {
  const volver = sessionStorage.getItem('helpcare_volver');
  sessionStorage.removeItem('helpcare_volver');
  if (volver && !/#\/(login|registro)/.test(volver)) location.hash = volver;
  else navegar('cuenta');
}

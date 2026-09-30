// Configuración del frontend. En local usa el backend de tu máquina; publicado,
// el de Render. Si el backend cambia de dirección, edítala aquí (y agrégala a
// connect-src en la CSP de index.html si no termina en .onrender.com).
const ES_LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);

window.HELPCARE_CONFIG = {
    apiBase: ES_LOCAL ? 'http://localhost:3000' : 'https://helpcare-api.onrender.com',
  // Centro inicial del mapa si la persona no comparte su ubicación.
  mapaCentro: { lat: 17.9892, lng: -92.9281, zoom: 13 },
};

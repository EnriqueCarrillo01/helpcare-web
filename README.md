# HelpCare — Frontend

Interfaz web de HelpCare: mapa de centros de acopio, catálogo de necesidades,
donación con seguimiento, panel de institución y panel de administración.
HTML, CSS y JavaScript sin paso de compilación (módulos ES nativos).

## Qué incluye

- **Mapa de centros** (vista inicial): Leaflet + OpenStreetMap, marcadores por
  urgencia (la crítica lleva doble anillo, no solo otro color), agrupación de
  marcadores cercanos, filtro por tipo y urgencia, búsqueda por distancia con
  la ubicación del navegador y enlace "Cómo llegar".
- **Necesidades**: catálogo público ordenado por urgencia, con avance
  (entregado / comprometido / faltante) y detalle con seguimiento anónimo.
- **Donar**: diálogo para comprometer una cantidad; "Mis donaciones" permite
  avisar "Voy en camino" o cancelar.
- **Mi institución**: confirmar entregas recibidas, publicar y editar
  necesidades, registrar centros eligiendo la ubicación en un minimapa.
- **Administración**: aprobar instituciones y necesidades; listado de cuentas.
- **Impacto**: cifras públicas basadas solo en entregas confirmadas.
- **Tiempo real**: las vistas se actualizan solas (Server-Sent Events).
- Manejo de sesión expirada, avisos de carga, aviso cuando el servidor de
  Render está "despertando", navegación con teclado y diseño responsivo.

## Ejecutar en local

Los módulos ES requieren servir los archivos por HTTP (abrir `index.html` con
doble clic no funciona):

```bash
python3 -m http.server 5500
# o: npx serve -l 5500
```

Abre http://localhost:5500 con el backend corriendo en http://localhost:3000
(con `CORS_ORIGIN=http://localhost:5500`). En local, la barra lateral muestra
"Conexión con el servidor" para cambiar la URL del backend; publicado, ese
panel no aparece y se usa `config.js`.

## Configuración

`config.js` usa `http://localhost:3000` cuando la página se abre en
`localhost` y `https://helpcare-auth-module.onrender.com` una vez publicada.
Si el backend cambia de dirección, edítala ahí.

La política de seguridad de contenido (CSP) está en `index.html`. Si el
backend no está en `*.onrender.com`, agrega su dominio a `connect-src`.

## Publicar

**Render (Static Site):** *New → Static Site*, repositorio del frontend,
*Build Command* vacío, *Publish Directory* `.`. Después agrega la URL
resultante a `CORS_ORIGIN` en el backend.

**GitHub Pages:** *Settings → Pages → Deploy from a branch → main / (root)*.

La geolocalización del navegador solo funciona en `https` o en `localhost`.

## Estructura

```
index.html            estructura, CSP y carga de scripts
config.js             URL del backend y centro inicial del mapa
styles.css            sistema visual (Fraunces + IBM Plex Sans, verde bosque y ámbar)
js/main.js            enrutador por hash (#/mapa, #/necesidades, ...) y barra lateral
js/api.js             fetch con token, tiempo límite y mensajes de error claros
js/sesion.js          sesión en localStorage
js/tiempo-real.js     conexión SSE con el backend
js/donar.js           diálogo de donación
js/ui.js              utilidades de interfaz (todo texto se inserta como texto, nunca como HTML)
js/vistas/            una vista por sección
vendor/               Leaflet 1.9.4 y Leaflet.markercluster 1.5.3 (licencias BSD-2 y MIT incluidas)
```

## Notas

- Los mosaicos del mapa vienen de los servidores de OpenStreetMap, que exigen
  la atribución visible y un uso moderado; para tráfico real conviene un
  proveedor de mosaicos con plan propio.
- El token de sesión vive en `localStorage`. La interfaz nunca inserta HTML
  proveniente del servidor y la CSP solo permite scripts propios, que es lo
  que mitiga el robo del token por XSS.

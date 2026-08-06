# QA con lector de pantalla (NVDA) — Aparkeo

Checklist manual para validar la accesibilidad real de los flujos principales tras la
auditoría a11y (roadmap nº20). Duración estimada: **30–45 minutos**.

> Público objetivo de esta app: personas con movilidad reducida. La accesibilidad
> con lector de pantalla es un requisito de producto, no un extra.

---

## 0. Preparación (5 min)

1. Descarga NVDA (gratuito): https://www.nvaccess.org/download/
2. Navegador recomendado: **Chrome, Edge o Firefox** (Brave es Chromium y funciona,
   pero si algo raro pasa, contrasta con Chrome).
3. Abre https://aparkeo.com y arranca NVDA (`Ctrl+Alt+N`).
4. Prueba en **modo claro y oscuro** (el toggle está en la navbar).

### Comandos NVDA esenciales

| Tecla | Acción |
|---|---|
| `NVDA+Q` | Salir de NVDA |
| `H` / `Shift+H` | Siguiente / anterior encabezado |
| `K` | Siguiente enlace |
| `B` | Siguiente botón |
| `F` | Siguiente control de formulario |
| `D` | Siguiente región/landmark |
| `Tab` / `Shift+Tab` | Siguiente / anterior elemento enfocable |
| `Enter` / `Espacio` | Activar |
| `NVDA+Espacio` | Alternar modo foco/navegación |
| `Ctrl` | Detener la lectura |

**Regla de oro durante toda la prueba:** en cada paso pregúntate —
*¿NVDA anuncia QUÉ es el elemento, PARA QUÉ sirve y QUÉ acaba de pasar?*
Anota cualquier «botón» o «enlace» leído sin nombre, cualquier cambio en pantalla
que no se anuncie, y cualquier foco perdido o atrapado.

---

## 1. Navegación global (5 min)

| # | Paso | Resultado esperado | ✅/❌ |
|---|---|---|---|
| 1.1 | Recarga la home y pulsa `Tab` una vez | Aparece y se anuncia «Saltar al contenido principal» | |
| 1.2 | Activa el skip-link | El foco salta al contenido (NVDA lo lee); no queda en la navbar | |
| 1.3 | Navega con `H` | Los encabezados tienen jerarquía lógica (no saltos H1→H3 sin sentido) | |
| 1.4 | Navega la navbar con `Tab` | Cada enlace se anuncia con su nombre («Mapa», «Estadísticas», «Analítica», «Reportar»…) | |
| 1.5 | Activa el toggle de tema con teclado | Se anuncia como botón con estado (claro/oscuro) | |
| 1.6 | Abre el menú móvil (ventana estrecha) con teclado | Se abre, el foco entra, `Escape` lo cierra y devuelve el foco al botón | |
| 1.7 | Campana de notificaciones | Se anuncia con nombre y contador; su contenido es legible con `Tab` | |

## 2. Flujo del mapa (`/map`) (10 min)

| # | Paso | Resultado esperado | ✅/❌ |
|---|---|---|---|
| 2.1 | Entra a `/map` | NVDA anuncia el título «Mapa de plazas PMR · Aparkeo» | |
| 2.2 | Espera a que carguen las plazas | Una región `aria-live` anuncia el número de plazas cargadas | |
| 2.3 | `Tab` hasta el mapa | El contenedor es enfocable (tecla `keyboard` de Leaflet activa) | |
| 2.4 | Sigue con `Tab` sobre los marcadores | Cada marcador se anuncia: «Plaza PMR en {calle} — {estado}, botón» | |
| 2.5 | Pulsa `Enter` en un marcador | Se abre el popup y su contenido se puede leer | |
| 2.6 | Selector de capa (calle/satélite) | Botones con nombre y estado seleccionado | |
| 2.7 | Buscador de destino: escribe «Corte Inglés» | Los resultados se anuncian con su número (región `aria-live`) y se pueden recorrer con `Tab` | |
| 2.8 | Tarjeta «mejor plaza» (si aparece) | La recomendación se anuncia al actualizarse (`aria-live="polite"`) | |
| 2.9 | Indicador «En directo» | Se anuncia como estado, sin repetirse en bucle | |
| 2.10 | Zoom con teclado (`+`/`-` sobre el mapa) | El mapa responde; NVDA no enloquece leyendo | |

## 3. Flujo de reporte (`/report` o desde el mapa) (10 min)

| # | Paso | Resultado esperado | ✅/❌ |
|---|---|---|---|
| 3.1 | Abre el modal de reporte | El foco entra al modal y queda atrapado dentro (focus trap) | |
| 3.2 | Recorre el formulario con `F` | Cada control anuncia su etiqueta (no solo «editable») | |
| 3.3 | Grupo libre/ocupada | Se anuncia como grupo con nombre; cada opción con su estado | |
| 3.4 | Provoca un error de geolocalización (deniega el permiso) | El error se anuncia de inmediato (`role="alert"`) | |
| 3.5 | Envía el reporte | El toast de confirmación se anuncia | |
| 3.6 | Envía otro seguido (cooldown 60 s) | El mensaje «Espera antes de volver a reportar…» se anuncia | |
| 3.7 | Cierra con `Escape` | El modal se cierra y el foco vuelve al botón que lo abrió | |

## 4. Detalle de plaza (`/spots/[id]`) (10 min)

| # | Paso | Resultado esperado | ✅/❌ |
|---|---|---|---|
| 4.1 | Abre una plaza desde el mapa | Título anunciado: «Plaza PMR en {calle} · Aparkeo» | |
| 4.2 | Botón de favorito | Nombre + estado («marcar/quitar favorito») | |
| 4.3 | Botón compartir | Se anuncia con nombre; al activarlo en desktop, toast «Enlace copiado» anunciado | |
| 4.4 | Galería de fotos | Cada foto tiene `alt` con la calle; el lightbox atrapa foco y `Escape` lo cierra | |
| 4.5 | Formulario de comentario | Textarea con etiqueta, contador 0/500 comprensible, botón «Comentar» con estado deshabilitado cuando vacío | |
| 4.6 | Publica un comentario de prueba | La lista se actualiza y el cambio se percibe (y bórralo después) | |
| 4.7 | Botones de borrar/ocultar | Con nombre claro, no solo icono | |

## 5. Autenticación y cuenta (5 min)

| # | Paso | Resultado esperado | ✅/❌ |
|---|---|---|---|
| 5.1 | `/login`: recorre el formulario | Email y contraseña con etiqueta asociada | |
| 5.2 | Envía credenciales malas | El error se anuncia (`aria-invalid`/`role="alert"`) | |
| 5.3 | `/register`: igual | Etiquetas + errores anunciados | |
| 5.4 | `/profile`: revisa ajustes | Todos los controles con nombre y estado | |

## 6. PWA y banner de instalación (3 min)

| # | Paso | Resultado esperado | ✅/❌ |
|---|---|---|---|
| 6.1 | Espera ~30 s en la app (2ª visita) | Si aparece el banner «Instalar app», se anuncia como región con nombre | |
| 6.2 | «Ahora no» con teclado | El banner desaparece y el foco no se pierde al vacío | |

---

## Plantilla de resultados

Copia esta tabla por cada fallo encontrado:

| # paso | Qué pasa | Qué debería pasar | Severidad (alta/media/baja) |
|---|---|---|---|
| | | | |

**Severidad alta** = bloquea completar un flujo (reportar, comentar, instalar).
**Media** = se puede completar pero con fricción o sin confirmación audible.
**Baja** = molestia cosmética.

## Criterio de aceptación

- Cero fallos de severidad alta en los flujos 2, 3 y 4.
- Los anuncios `aria-live` de la auditoría nº20 se confirman audibles (2.2, 2.7, 2.8, 3.4, 3.5).
- Todo lo operable con ratón lo es también solo con teclado.

Anota los hallazgos en este mismo archivo (sección «Resultados») y créales
entrada en el roadmap de `docs/AUDIT-2026-07-31.md` si requieren código.

## Resultados

*(pendiente de la primera pasada)*

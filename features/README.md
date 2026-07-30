# features/

Reservado para cuando una funcionalidad crezca lo bastante (componentes +
hooks + lógica propios) como para no caber bien repartida entre `components/`
y `hooks/` genéricos — por ejemplo, si en el futuro se añade un módulo de
"reservas temporales de plaza" con su propio estado, componentes y llamadas
a API, viviría en `features/reservations/`.

Hoy el proyecto es pequeño y todo vive en `components/`, `hooks/` y
`services/` a nivel raíz — esta carpeta queda vacía a propósito hasta que
haga falta, en vez de forzar una estructura prematura.

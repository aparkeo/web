# Tests — MinusVigo Web

Infraestructura de tests del proyecto: **Vitest** para unitarios y **Playwright**
para E2E. No hay tests en CI más allá de los unitarios (ver
`.github/workflows/test.yml`).

## Requisitos

- Node 20+ (en Git Bash de esta máquina: `export PATH="/c/Program Files/nodejs:$PATH"`).
- `npm install` ya hecho (las deps de test son devDependencies).
- Solo para E2E: navegador Chromium de Playwright:
  `npx playwright install chromium` (una vez; si falla por red, reintentar más tarde).

## Tests unitarios (Vitest)

```bash
npm run test         # una pasada
npm run test:watch   # modo watch
```

- Viven en `tests/unit/`, config en `vitest.config.ts` (alias `@/` igual que
  tsconfig, jsdom + jest-dom vía `tests/setup.ts`).
- **Nunca tocan la base de datos**: `lib/prisma` se mockea con `vi.mock`
  (ver `tests/unit/prediction.test.ts` como patrón).
- Cobertura actual:
  - `lib/utils.ts` — haversine (`distanceMeters`), formatters, `cn`.
  - `lib/prediction.ts` — consenso live (`computeConsensus`), reputación
    (`classifyReputationReports` + clamp SQL en `recalculateSpotStatus`),
    `vigoNow`, `getSpotPrediction`, `rankSpotsByRecommendation`.
  - `lib/rateLimit.ts` — token bucket en memoria con fake timers, backend
    Upstash con SDK mockeado (fixed window, reuso de limiters), fail-open a
    memoria ante errores de Redis, `getClientIp`.
  - `components/StatusBadge.tsx` — patrón base de test de componentes con
    Testing Library.
  - `lib/notifications.ts` — detector de transición puro (`isFreeTransition`)
    y fan-out FAVORITE_FREED: exclusión del autor, push solo a usuarios con
    suscripción, anti-spam de 2 h por usuario+plaza.
  - `lib/push.ts` — `sendPushToUser` con web-push mockeado: conteo de envíos,
    limpieza de suscripciones caducadas (404/410), errores sin propagar.

## Tests E2E (Playwright)

```bash
npx playwright install chromium   # primera vez
npm run test:e2e                  # levanta `npm run dev` solo (o reusa uno activo)
```

- Viven en `tests/e2e/`, config en `playwright.config.ts`.
- `E2E_BASE_URL` selecciona el entorno (default `http://localhost:3000`).
  **No apuntar nunca a producción**: los E2E escriben en la base de datos del
  `.env` local.
- Specs:
  - `smoke.spec.ts` — solo lectura: home con buscador y `/login`.
  - `report-consensus.spec.ts` — flujo core: registro vía UI → sesión →
    reporte `FREE` sobre una plaza ficticia → verificación del consenso vía API.

### ⚠️ Base de datos compartida (Supabase)

El dev server usa la misma Supabase de siempre, así que los E2E que escriben
datos siguen estas reglas (implementadas en `report-consensus.spec.ts`):

1. **Plaza ficticia dedicada** con id **negativo** (`-900001`; los ids reales
   del dataset del Concello son positivos) y calle marcada como TEST.
2. **Usuario de test único** por ejecución:
   `e2e+<timestamp>@test.minusvigo.local`.
3. **Limpieza obligatoria en `afterAll`** vía Prisma: reportes, eventos,
   notificaciones y usuario de test, plaza ficticia y sus predicciones — se
   ejecuta aunque el test falle.

### Variables de entorno necesarias para E2E

| Variable | Para qué | Si falta |
|---|---|---|
| `E2E_BASE_URL` | URL objetivo (opcional) | usa `http://localhost:3000` |
| `DATABASE_URL` | setup/limpieza de `report-consensus.spec.ts` (se carga de `.env`) | ese spec se **salta** con `test.skip`; los smoke corren igual |

El dev server necesita además las envs de siempre (`AUTH_SECRET`, etc.), que
ya viven en `.env`. **Nunca** copies valores reales al repo: usa
`.env.test.example` como referencia de qué hace falta.

## CI

`.github/workflows/test.yml` corre **solo unitarios** (`npm run test`) en
push/PR a `main`. Los E2E **no** corren en CI a propósito: dependen de la base
de datos compartida.

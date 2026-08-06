# Aparkeo Web

Versión web de Aparkeo — plataforma hecha en Galicia para encontrar plazas PMR
libres en Galicia y toda España, con predicción inteligente, reportes de la
comunidad, panel de administración y estadísticas.

**Proyecto totalmente independiente de la app móvil** (carpeta `minusvigo`).
No comparte código, base de datos ni backend. Solo el dominio del problema.

## Stack

- **Frontend:** Next.js 15 (App Router) · TypeScript · TailwindCSS · shadcn/ui (componentes en `components/ui`) · React Query · Zustand
- **Mapas:** React Leaflet + OpenStreetMap (gratuito, sin API key)
- **Backend:** Next.js API Routes
- **Base de datos:** PostgreSQL + Prisma
- **Auth:** NextAuth v5 (Credentials provider, JWT sessions)
- **Despliegue:** Vercel + cualquier Postgres administrado (Supabase, Neon, Railway…)

## Estructura del proyecto

```
minusvigo-web/
├── app/                  # Next.js App Router: páginas + API routes + SEO
│   ├── api/               # Endpoints backend (route handlers)
│   ├── admin/              # Panel de administración (protegido)
│   ├── spots/[id]/         # Página de plaza individual
│   ├── map/, stats/, report/, profile/, login/, register/
│   ├── layout.tsx          # Layout raíz + metadata SEO/Open Graph
│   ├── providers.tsx       # SessionProvider + QueryClientProvider + Toaster
│   ├── sitemap.ts, robots.ts
│   └── globals.css
├── components/            # Componentes de UI
│   ├── ui/                  # Primitivas estilo shadcn/ui (Button, Card, Dialog…)
│   └── *.tsx                 # Componentes de dominio (MapView, SpotCard, PredictionCard…)
├── features/               # (reservado) lógica de features grandes si el proyecto crece
├── lib/                    # Lógica de servidor compartida: prisma client, auth config, algoritmo de predicción, utils
├── services/                # Wrappers fetch del cliente hacia la API (sin lógica de estado)
├── hooks/                   # Hooks de React Query / mutaciones que usan services/
├── store/                   # Estado global de cliente (Zustand): mapa, filtros
├── types/                   # Tipos compartidos cliente/servidor (DTOs)
├── prisma/                 # schema.prisma + seed.ts
└── middleware.ts            # Protección de /admin a nivel de edge
```

### Por qué esta separación

- `services/` nunca importa React: solo `fetch` + tipos. `hooks/` envuelve esos
  services en `useQuery`/`useMutation`. Así se puede testear `services/` sin
  montar componentes, y cambiar de React Query a otra cosa sin tocar la UI.
- `store/` (Zustand) es solo estado de **cliente** (qué plaza está seleccionada,
  filtros activos). El estado de **servidor** (las plazas, sus reportes) vive
  en React Query, nunca en Zustand — evita la duplicación clásica de
  "¿esto va en Redux o en el cache de fetch?".
- `lib/prediction.ts` es deliberadamente independiente de Next.js: son
  funciones puras sobre Prisma que tanto una API route como un futuro cron
  job pueden llamar igual.

## Arranque local

```bash
cd minusvigo-web
npm install
cp .env.example .env        # rellena DATABASE_URL y AUTH_SECRET
npx prisma db push          # crea las tablas
npm run db:seed             # usuario admin de referencia
npm run db:import-spots     # las ~843 plazas PMR reales del Concello de Vigo
npm run dev
```

Abre http://localhost:3000.

`db:import-spots` (`scripts/import-spots.ts`) descarga el mismo feed oficial
que usa la app móvil (`PARKING_DATA_URL` en `.env`) y hace upsert por `id` —
puedes volver a ejecutarlo cuando quieras para traer altas/bajas de plazas
sin tocar el estado/consenso ya calculado.

Para entrar como administrador: regístrate normal en `/register`, luego
sube tu rol a mano una vez (`npx prisma studio` → tabla `users` → `role: ADMIN`).
El seed crea `admin@minusvigo.dev` sin contraseña (OAuth-only) solo como
referencia de datos; para probar el panel admin de verdad, registra una
cuenta propia y promociónala.

## Sistema de predicción (resumen — detalle en `lib/prediction.ts`)

Dos señales combinadas:

1. **Live** — consenso de los últimos 15 min de `Report` (mismo algoritmo
   de pesos que la app móvil: ≥2 de peso y mayoría → confirmado).
2. **Histórico** — probabilidad agregada de "libre" para esa plaza, ese día
   de la semana y esa hora, sobre todo el historial (tabla `Prediction`).

Si hay señal viva fuerte, gana esa. Si no, se usa el histórico, o una mezcla
60/40 cuando hay algo de señal viva pero insuficiente consenso.

## Despliegue en Vercel

1. Conecta el repo, **Root Directory = `minusvigo-web`**.
2. Variables de entorno: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL` (la URL de
   producción), opcionalmente `NEXT_PUBLIC_MAPBOX_TOKEN` y `NEXT_PUBLIC_SITE_URL`.
3. Build command ya incluye `prisma generate` (ver `package.json`).
4. Ejecuta `npx prisma db push` contra la base de producción antes del primer
   deploy (o usa `prisma migrate deploy` si prefieres migraciones versionadas).

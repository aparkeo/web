# Despliegue en Vercel

Guía para publicar MinusVigo Web en producción. Todo está preparado;
solo falta la autenticación (interactiva, la hace el propietario).

## Prerrequisitos ya resueltos

- ✅ Build de producción validado (`npm run build`)
- ✅ Base de datos en Supabase cloud (accesible desde Vercel sin túneles)
- ✅ `vercel.json` con región `lhr1` (Londres — la más cercana a la DB en Irlanda)
- ✅ El script `build` ya ejecuta `prisma generate` automáticamente

## Opción A — Dashboard (recomendada, 5 min)

1. Entra en https://vercel.com/new e inicia sesión con GitHub
2. Importa el repo `adrianalvarezfreire11/minusvigo-web`
3. En **Environment Variables**, añade las de la tabla de abajo
4. Pulsa **Deploy**

## Opción B — CLI

```bash
npx vercel login          # interactivo (email o GitHub)
npx vercel link           # enlaza este directorio con el proyecto
npx vercel env add DATABASE_URL production
npx vercel env add AUTH_SECRET production
npx vercel env add AUTH_URL production
npx vercel env add AUTH_TRUST_HOST production
npx vercel env add PARKING_DATA_URL production
npx vercel --prod
```

## Variables de entorno

| Variable | Valor | Notas |
|---|---|---|
| `DATABASE_URL` | La de tu `.env` local (pooler de Supabase, puerto 5432) | Usar el **session pooler**, no la conexión directa (IPv6) |
| `AUTH_SECRET` | El de tu `.env` local | Mismo secreto que en desarrollo |
| `AUTH_URL` | `https://<tu-proyecto>.vercel.app` | Se conoce tras el primer deploy; actualízala después |
| `AUTH_TRUST_HOST` | `true` | Permite a NextAuth v5 confiar en el host de Vercel |
| `PARKING_DATA_URL` | `https://datos.vigo.org/data/trafico/plazas_minusvalido.json` | Feed oficial del Concello |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | *(vacío)* | Opcional; sin él se usa OpenStreetMap |

## Tras el primer deploy

1. Anota el dominio asignado (`<proyecto>.vercel.app`)
2. Actualiza `AUTH_URL` con ese dominio y redeploya (o espera al siguiente push)
3. Verifica: home carga, `/map` muestra las 843 plazas, registro/login funcionan
4. La CI de GitHub Actions ya valida typecheck + lint + build en cada push

## Notas

- La base de datos ya está poblada; no hace falta `db push` ni seed en producción
- Para re-importar plazas PMR en el futuro: `npm run db:import-spots` (idempotente)
- Dominio personalizado: Vercel → Project → Settings → Domains

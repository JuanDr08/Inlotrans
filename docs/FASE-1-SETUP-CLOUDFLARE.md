# Fase 1 — Setup Cloudflare + Schema D1

## Qué se hizo

1. **Schema D1** (`migrations/0001_schema.sql`) — 12 tablas migrando de Postgres a SQLite:
   - `auth_users` — reemplaza `auth.users` de Supabase (email + password hash + ban)
   - `usuarios`, `perfiles`, `operaciones`, `turnos`, `tarifas` — tablas de configuración
   - `novedades` — con `tipo_ausentismo` y `codigo_causa` para planos
   - `jornadas` — tabla central con 9 tipos de minutos + índice parcial único para ABIERTO
   - `aprobaciones_extras`, `bolsa_horas`, `movimientos_bolsa` — motor de liquidación
   - `semanas_dominicales` — cumplimiento 44h con índice compuesto para upsert
   - `alertas` — sistema de notificaciones

2. **Seed de tarifas** (`migrations/0002_seed.sql`) — tarifas 2026 iniciales

3. **Wrangler config** (`wrangler.toml`):
   - D1 binding: `DB`
   - KV binding: `CACHE` (para festivos y tarifas cache)
   - Cron trigger: `0 0 * * *` (diario 00:00 UTC = 19:00 Colombia)
   - `nodejs_compat` flag habilitado (necesario para ExcelJS)

4. **D1 client utilities** (`src/lib/d1/client.ts`):
   - `getD1()` — acceso al binding D1
   - `getKV()` — acceso al binding KV
   - `getEnv()` — acceso a env completo
   - `generateId()` — wrapper de `crypto.randomUUID()` (reemplaza `gen_random_uuid()` de Postgres)

5. **Tipos Cloudflare** (`src/lib/d1/types.ts`) — tipado de `CloudflareEnv`

6. **OpenNext config** (`open-next.config.ts`) — adapter para Next.js en Cloudflare

7. **next.config.ts** — `serverExternalPackages: ['exceljs']` para que no se bundlee

8. **.gitignore** — agregados `.wrangler/`, `.open-next/`, `.dev.vars`

## Diferencias clave SQLite vs Postgres

| Concepto | Postgres (Supabase) | SQLite (D1) |
|---|---|---|
| Booleans | `boolean` | `INTEGER` (0/1) |
| Timestamps | `timestamp with time zone` | `TEXT` (ISO string) |
| UUID default | `gen_random_uuid()` | `crypto.randomUUID()` en app |
| Upsert | `.upsert({ onConflict })` | `INSERT ... ON CONFLICT DO UPDATE` |
| RLS | Políticas en DB | Toda la seguridad en app |
| Partial unique index | `CREATE UNIQUE INDEX ... WHERE` | Soportado igual |

## Configuración necesaria

### 1. Instalar dependencias

```bash
npm install @opennextjs/cloudflare
npm install -D wrangler
```

### 2. Crear la base de datos D1

```bash
npx wrangler d1 create inlotrans-asistencia-db
```

Copiar el `database_id` devuelto al campo vacío en `wrangler.toml`.

### 3. Crear el namespace KV

```bash
npx wrangler kv namespace create CACHE
```

Copiar el `id` devuelto al campo vacío en `wrangler.toml`.

### 4. Ejecutar las migraciones

```bash
npx wrangler d1 execute inlotrans-asistencia-db --file=migrations/0001_schema.sql
npx wrangler d1 execute inlotrans-asistencia-db --file=migrations/0002_seed.sql
```

Para desarrollo local:
```bash
npx wrangler d1 execute inlotrans-asistencia-db --file=migrations/0001_schema.sql --local
npx wrangler d1 execute inlotrans-asistencia-db --file=migrations/0002_seed.sql --local
```

### 5. Configurar secrets

```bash
cp .dev.vars.example .dev.vars
# Editar .dev.vars con los valores reales

# Para producción:
npx wrangler secret put AUTH_SECRET
npx wrangler secret put CRON_SECRET
```

## Próxima fase

**Fase 2 — Autenticación**: Reemplazar Supabase GoTrue con auth custom (JWT + bcrypt sobre D1). Afecta `login/actions.ts`, `auth.ts`, `middleware.ts`, `usuarios-actions.ts`.

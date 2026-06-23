# Fase 6 — Cleanup + Preparación de Deploy

## Qué se hizo

Eliminación completa de las dependencias de Supabase y preparación del proyecto para deploy en Cloudflare.

### Archivos eliminados

- `src/lib/supabase/server.ts` — Cliente Supabase con cookies (ya no usado)
- `src/lib/supabase/client.ts` — Cliente browser (nunca fue usado por componentes)
- `src/lib/supabase/admin.ts` — Cliente service role (reemplazado por D1 directo)
- `src/lib/supabase/middleware.ts` — Movido a `src/lib/auth/middleware.ts`
- Directorio `src/lib/supabase/` eliminado

### Archivos modificados

1. **`src/middleware.ts`** — Import actualizado de `@/lib/supabase/middleware` → `@/lib/auth/middleware`
2. **`src/lib/auth/middleware.ts`** — Movido desde supabase/, limpiado import no usado (`SESSION_COOKIE`)
3. **`package.json`** — Eliminadas dependencias:
   - `@supabase/ssr` (^0.8.0)
   - `@supabase/supabase-js` (^2.97.0)

## Estado del proyecto post-migración

### Zero dependencias de Supabase

```bash
rg "supabase" src/ --files-with-matches
# (sin resultados)
```

### Stack actual

| Componente | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 |
| Base de datos | Cloudflare D1 (SQLite) |
| Auth | Custom JWT (HMAC-SHA256) + PBKDF2 |
| Cache | Cloudflare KV |
| Excel | ExcelJS (`nodejs_compat`) |
| Hosting | Cloudflare Pages (via @opennextjs/cloudflare) |

### Variables de entorno necesarias

```bash
# Secretos (configurar via wrangler secret put):
AUTH_SECRET          # JWT signing key (≥32 chars)
CRON_SECRET          # Protege endpoint cron (opcional)

# Ya NO necesarios:
# NEXT_PUBLIC_SUPABASE_URL        (eliminado)
# NEXT_PUBLIC_SUPABASE_ANON_KEY   (eliminado)
# SUPABASE_SERVICE_ROLE_KEY       (eliminado)
```

## ExcelJS en Workers

ExcelJS se configura como `serverExternalPackages` en `next.config.ts` y depende del flag `nodejs_compat` en `wrangler.toml`. Esto ya está configurado:

- `next.config.ts`: `serverExternalPackages: ['exceljs']`
- `wrangler.toml`: `compatibility_flags = ["nodejs_compat"]`

La validación real se hará en Fase 7 (deploy + testing de integración). Si ExcelJS no funciona con `nodejs_compat`, la alternativa es una librería WASM/pura.

## Pasos para deploy (Fase 7)

### 1. Instalar dependencias de Cloudflare

```bash
npm install @opennextjs/cloudflare
npm install -D @cloudflare/workers-types
```

### 2. Crear recursos en Cloudflare

```bash
# Base de datos D1
npx wrangler d1 create inlotrans-asistencia-db
# → Copiar database_id en wrangler.toml

# KV Namespace
npx wrangler kv namespace create CACHE
# → Copiar id en wrangler.toml

# Ejecutar migraciones
npx wrangler d1 execute inlotrans-asistencia-db --file=migrations/0001_schema.sql
npx wrangler d1 execute inlotrans-asistencia-db --file=migrations/0002_seed.sql
```

### 3. Configurar secretos

```bash
npx wrangler secret put AUTH_SECRET
npx wrangler secret put CRON_SECRET  # opcional
```

### 4. Crear primer usuario admin

```bash
# Generar hash (usar la función hashPassword de src/lib/auth/password.ts)
# O registrar via /login en desarrollo y luego crear perfil:
npx wrangler d1 execute inlotrans-asistencia-db --command "
  INSERT INTO perfiles (id, rol, operacion_nombre)
  VALUES ('id-del-usuario-registrado', 'admin', NULL);
"
```

### 5. Build y deploy

```bash
npx opennextjs-cloudflare build
npx wrangler pages deploy .open-next/assets --project-name=inlotrans-asistencia
```

### 6. Verificación

- [ ] Login funciona
- [ ] Kiosco (registro entrada/salida) funciona
- [ ] Dashboard admin carga
- [ ] Operaciones CRUD funciona
- [ ] Empleados CRUD funciona
- [ ] Novedades CRUD funciona
- [ ] Aprobaciones extras funciona
- [ ] Corrección de inconsistentes funciona
- [ ] Descarga Excel nómina funciona
- [ ] Descarga planos (cumpleaños, auxilio, extras, otro) funciona
- [ ] Cron manual: `curl -H "Authorization: Bearer $CRON_SECRET" https://app.example.com/api/cron/autocierre`

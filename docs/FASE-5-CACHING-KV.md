# Fase 5 — Caching (module-scope → Cloudflare KV)

## Qué se hizo

Reemplazo de los caches en module-scope (`calculoHoras.ts`) por Cloudflare KV con TTL nativo. Los isolates de Workers son efímeros — las variables de módulo se pierden entre requests. KV persiste los datos con expiración automática.

### Archivo modificado

**`src/lib/calculoHoras.ts`**

## Caches migrados

### 1. Días festivos (API Colombia)

| Aspecto | Antes | Ahora |
|---|---|---|
| Storage | `const cacheDiasFestivos: Record<number, CacheFestivo>` (module-scope) | Cloudflare KV key `festivos:{año}` |
| TTL | 24h (manual timestamp check) | 24h (`expirationTtl: 86400`) |
| Formato | `Date[]` en memoria | JSON string de ISOs en KV |
| Fallback | Cache viejo si API falla | Array vacío (KV puede tener la anterior si no expiró) |
| Persistencia | Se pierde en cold start | Persiste entre requests y deploys |

**KV key**: `festivos:2026`
**Valor**: `["2026-01-01T00:00:00.000Z", "2026-01-12T00:00:00.000Z", ...]`

### 2. Tarifas (tabla D1)

| Aspecto | Antes | Ahora |
|---|---|---|
| Storage | `let cacheTarifas` + `let cacheTarifasTimestamp` (module-scope) | Cloudflare KV key `tarifas:activas` |
| TTL | 5 min (manual timestamp check) | 5 min (`expirationTtl: 300`) |
| Formato | `Record<string, number>` en memoria | JSON string en KV |
| Fallback | Tarifas hardcodeadas 2026 | Mismas tarifas hardcodeadas 2026 |
| Persistencia | Se pierde en cold start | Persiste entre requests |

**KV key**: `tarifas:activas`
**Valor**: `{"normal":7959,"nocturno":10745,...}`

## Patrón KV usado

```ts
import { getKV } from '@/lib/d1/client'

const kv = getKV()

// Leer
const cached = await kv.get('key')
if (cached) return JSON.parse(cached)

// Escribir con TTL
await kv.put('key', JSON.stringify(data), { expirationTtl: 300 })
```

KV maneja la expiración automáticamente — no hay que comparar timestamps.

## Binding KV

Ya configurado en `wrangler.toml` desde la Fase 1:

```toml
[[kv_namespaces]]
binding = "CACHE"
id = ""  # Fill after: wrangler kv namespace create CACHE
```

### Configuración necesaria

Crear el namespace KV (si no se hizo en Fase 1):

```bash
npx wrangler kv namespace create CACHE
# Copiar el ID en wrangler.toml
```

## `unstable_cache` en operaciones-actions.ts

El cache de operaciones activas para el kiosco usa `unstable_cache` de Next.js (no module-scope). Se mantiene como está — el adapter OpenNext gestiona la implementación del cache store. Si no funciona correctamente en producción, se puede reemplazar por KV en el futuro.

## Próxima fase

**Fase 6 — ExcelJS compatibility**: Verificar que ExcelJS funciona con `nodejs_compat` en Workers, o reemplazar la librería.

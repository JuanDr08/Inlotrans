# Fase 4 — Cron Optimizado (N×3 queries → SQL agregado + batch)

## Qué se hizo

Optimización del cron diario de autocierre para cumplir con los límites de CPU time de Cloudflare Workers (30s para cron triggers en plan pagado).

### Archivo modificado

**`src/app/api/cron/autocierre/route.ts`**

## Optimizaciones aplicadas

### 1. Detección de inconsistentes → `db.batch()`

**Antes**: N queries secuenciales (1 UPDATE + 1 INSERT por jornada abierta vencida).
Con 50 jornadas inconsistentes = 100 round-trips a D1.

**Ahora**: 
- 1 SELECT con filtro directo `WHERE entrada < ?` (el umbral se calcula en app y se pasa como parámetro, eliminando el loop de filtrado en JS)
- 1 `db.batch()` atómico con todos los UPDATEs e INSERTs juntos

```
Antes: 1 + N×2 queries = 101 queries (50 jornadas)
Ahora: 1 + 1 batch    = 2 queries
```

### 2. Cierre dominical → SQL agregado + batch

**Antes**: Por cada empleado activo (N):
- 1 SELECT de jornadas de la semana → sum en JS
- 1 SELECT de novedades remuneradas → cálculo en JS  
- 1 UPSERT de semanas_dominicales

Con 300 empleados = 900 round-trips secuenciales a D1.

**Ahora**:
- 1 `SELECT ... GROUP BY empleado_id` → minutos ordinarios de TODOS los empleados en una query
- 1 `SELECT ... WHERE es_pagado = 1 AND (fecha intersecta semana)` → novedades de TODOS en una query
- 1 `SELECT id FROM usuarios WHERE status = 'activo'` → lista de empleados
- 1 `db.batch()` con N upserts atómicos

```
Antes: 1 + N×3 queries = 901 queries (300 empleados)
Ahora: 3 + 1 batch     = 4 queries
```

### 3. Novedades: filtro por intersección de fecha en SQL

**Antes**: Traía TODAS las novedades remuneradas del empleado y filtraba en JS.

**Ahora**: Filtra directamente en SQL con:
```sql
WHERE es_pagado = 1
  AND ((fecha_novedad >= ? AND fecha_novedad <= ?)
       OR (fecha_inicio <= ? AND fecha_fin >= ?))
```

Solo trae las novedades que realmente intersectan la semana.

## Impacto en rendimiento

| Escenario | Antes (queries) | Ahora (queries) | Reducción |
|---|---|---|---|
| 0 inconsistentes, no domingo | 1 | 1 | — |
| 10 inconsistentes, no domingo | 21 | 2 | 90% |
| 0 inconsistentes, 300 empleados domingo | 901 | 4 | 99.6% |
| 10 inconsistentes, 300 empleados domingo | 922 | 6 | 99.3% |

## Cron Trigger de Cloudflare

Ya configurado desde Fase 1 en `wrangler.toml`:

```toml
[triggers]
crons = ["0 0 * * *"]  # Daily at 00:00 UTC (19:00 Colombia)
```

El endpoint `/api/cron/autocierre` se invoca automáticamente por Cloudflare. La autenticación con `CRON_SECRET` sigue activa como capa adicional.

### Configuración necesaria

Ninguna configuración adicional. El cron trigger ya está definido en `wrangler.toml` desde la Fase 1.

## Próxima fase

**Fase 5 — Caching (KV)**: Reemplazar los caches en module-scope (`cacheDiasFestivos`, `cacheTarifas`) por Cloudflare KV con TTL nativo.

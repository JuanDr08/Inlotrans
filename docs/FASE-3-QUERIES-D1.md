# Fase 3 — Queries D1 (Supabase PostgREST → SQL puro)

## Qué se hizo

Reescritura completa de todas las queries de Supabase PostgREST a SQL puro para Cloudflare D1. 17 archivos migrados, ~80 queries reemplazadas.

### Archivos migrados

#### Core libs (motor de liquidación + reportes)

1. **`src/lib/jornadas.ts`** — Motor de liquidación completo
   - 21 queries migradas (jornadas, bolsa_horas, movimientos_bolsa, alertas, aprobaciones_extras, novedades, operaciones)
   - Race condition arreglada: `registrarMovimientoBolsa` ahora usa `INSERT ... ON CONFLICT DO UPDATE` atómico en vez de SELECT→INSERT/UPDATE
   - Patrón INSERT+SELECT para operaciones que necesitan retornar la fila insertada/actualizada (D1 no soporta `.returning()`)
   - `generateId()` para todas las PKs nuevas

2. **`src/lib/calculoHoras.ts`** — Cache de tarifas
   - 1 query migrada: `obtenerTarifas()` ahora consulta D1 con `WHERE activo = 1`
   - Cache en memoria conservada (se migrará a KV en Fase 5)

3. **`src/lib/reportes.ts`** — Reportes agregados por período
   - 3 queries migradas
   - Embedded join `usuarios!inner(id, nombre)` reemplazado por `INNER JOIN` explícito
   - Filtro dinámico de operaciones con `IN (?, ?, ...)` parameterizado

#### Dashboard actions y pages

4. **`src/app/actions.ts`** — Validación de cédula en kiosco (1 query)
5. **`src/app/(dashboard)/empleados/actions.ts`** — CRUD empleados (5 queries)
   - Error `23505` (unique violation) reemplazado por detección de `UNIQUE constraint failed`
6. **`src/app/(dashboard)/empleados/page.tsx`** — Listado con filtro condicional por operación
7. **`src/app/(dashboard)/empleados/[cedula]/actions.ts`** — Detalle empleado (9 queries)
8. **`src/app/(dashboard)/novedades/actions.ts`** — CRUD novedades (5 queries)
   - `generateId()` para PK de novedades
   - Booleans como `1`/`0`
9. **`src/app/(dashboard)/novedades/page.tsx`** — Listado con JOIN
   - PostgREST `usuario:usuarios(nombre, operacion)` → `LEFT JOIN`
   - `es_pagado` convertido de INTEGER a boolean con `!!`
10. **`src/app/(dashboard)/aprobaciones/actions.ts`** — Aprobaciones + inconsistentes (5 queries)
    - Dos embedded joins reemplazados por JOINs explícitos
    - Resultado reestructurado para mantener la forma esperada por el UI: `{ jornadas: {...}, usuarios: {...} }`
11. **`src/app/(dashboard)/admin/operaciones-actions.ts`** — CRUD operaciones + turnos (13 queries)
    - `unstable_cache` ahora usa D1 directamente (sin crear Supabase client aparte)
    - Boolean `status` round-trip: `!!r.status` al leer, `? 1 : 0` al escribir

#### API routes (cron + reportes)

12. **`src/app/api/cron/autocierre/route.ts`** — Cron diario (8 queries)
    - `UPSERT` para `semanas_dominicales` con `ON CONFLICT(empleado_id, semana_inicio)`
    - `generateId()` para alertas y semanas_dominicales
13. **`src/app/api/reportes/nomina/route.ts`** — Excel nómina (6 queries)
    - `usuarios!inner(id, nombre, cargo)` → `INNER JOIN`
    - `.or()` de novedades → `WHERE (...) OR (...)`
    - Filtro dinámico de operaciones con placeholders
14. **`src/app/api/reportes/planos/extras/route.ts`** — Plano extras (2 queries)
15. **`src/app/api/reportes/planos/auxilio/route.ts`** — Plano auxilio (1 query)
16. **`src/app/api/reportes/planos/cumpleanos/route.ts`** — Plano cumpleaños (1 query)
17. **`src/app/api/reportes/planos/otro/route.ts`** — Plano genérico (1 query)
    - `.or()` → SQL `OR` con placeholders dinámicos
    - `es_pagado` condicional según clase

## Patrones de traducción aplicados

| Supabase PostgREST | D1 SQL |
|---|---|
| `.from('x').select('*').eq('id', v).maybeSingle()` | `db.prepare('SELECT * FROM x WHERE id = ?').bind(v).first()` |
| `.from('x').select('*').single()` | `.first()` + check null |
| `.from('x').select('*').order('col', { ascending: false })` | `ORDER BY col DESC` + `.all()` |
| `.insert({...}).select('*').single()` | INSERT + SELECT separados |
| `.update({...}).eq('id', v).select('*').single()` | UPDATE + SELECT separados |
| `.in('estado', ['A','B'])` | `WHERE estado IN (?, ?)` |
| `.eq('activo', true)` | `WHERE activo = 1` |
| `{ count: 'exact', head: true }` | `SELECT COUNT(*) as count` |
| `usuarios!inner(id, nombre)` | `INNER JOIN usuarios u ON u.id = ...` |
| `.upsert({}, { onConflict: 'col' })` | `INSERT ... ON CONFLICT(col) DO UPDATE SET` |
| `.or('and(...),and(...)')` | `WHERE (...) OR (...)` |

## Mejoras vs Supabase

- **Race condition eliminada**: `bolsa_horas` ahora usa upsert atómico
- **Queries más eficientes**: JOINs explícitos en vez de embedded relations de PostgREST
- **Un solo cliente**: Todo usa `getD1()` en vez de 3 tipos de clientes Supabase
- **Booleans explícitos**: `1`/`0` en vez de confiar en la coerción de PostgREST

## Configuración necesaria

No se requiere configuración adicional para esta fase. Los bindings de D1 ya están configurados desde la Fase 1.

## Dependencias eliminables (futuro)

Después de esta fase, los paquetes de Supabase ya no se usan en NINGÚN archivo del proyecto:
- `@supabase/ssr`
- `@supabase/supabase-js`

Pueden desinstalarse una vez se verifique todo en integración (Fase 7).

Los archivos en `src/lib/supabase/` (`client.ts`, `server.ts`, `admin.ts`) ya no son importados por nadie y pueden eliminarse.

## Próxima fase

**Fase 4 — Cron rewrite**: Optimizar el loop de cierre dominical (N×3 queries secuenciales → queries SQL agregadas) y configurar Cron Triggers de Cloudflare.

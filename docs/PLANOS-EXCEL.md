# Planos de Ausentismo — Documentación técnica

Referencia de mantenimiento para los generadores de planos Excel del sistema de asistencia Inlotrans. Complementa `ARCHITECTURE.md` y `GUIA-FUNCIONAL.md`.

---

## Visión general

Los **planos** son archivos `.xlsx` que replican el formato exacto que usa la empresa para reportar ausentismos y novedades de nómina a su sistema de liquidación. Cada plano cubre una **quincena** (1ª: días 1–15, 2ª: días 16–fin de mes) de un mes y año dados.

Se accede desde el dashboard administrativo mediante el botón **"Planos"**, que abre el diálogo de selección `ExportPlanosDialog`.

---

## Flujo de descarga

```
Usuario hace clic en "Planos"
  → ExportPlanosDialog (selección de tipo, mes, quincena, params extra si aplica)
  → window.open(url)                 ← mismo patrón que la exportación de nómina
  → GET /api/reportes/planos/{tipo}?anio=X&mes=X&quincena=X[&tipo=X&clase=X&causa=X]
  → Route handler (service role Supabase, bypasa RLS)
  → Genera buffer Excel con exceljs
  → Response con Content-Disposition: attachment
  → Navegador descarga el archivo
```

- La autenticación se aplica a nivel de middleware (cookies requeridas). Los route handlers no replican la verificación de sesión: si el middleware lo deja pasar, es un usuario autenticado.
- Los route handlers usan el cliente Supabase de service role para evitar restricciones de RLS.
- Los generadores viven en `src/lib/excel/planos/` separados de los route handlers para facilitar testing unitario.

---

## Diálogo de selección (`src/components/ExportPlanosDialog.tsx`)

Campos que el usuario completa antes de descargar:

| Campo | Descripción |
|-------|-------------|
| Tipo de plano | Cumpleaños / Auxilio No Prestacional / Horas Extras / Otro (por ausentismo) |
| Mes | 1–12 |
| Quincena | 1 (días 1–15) o 2 (días 16–fin de mes) |
| Tipo de ausentismo | Solo para "Otro" — selector con los 7 tipos de `TIPOS_AUSENTISMO` |
| Clase de ausentismo | Solo para "Otro" — selector con las 3 clases de `CLASES_AUSENTISMO` |
| Causa de ausentismo | Solo para "Otro" — selector con las 28 causas de `CAUSAS_AUSENTISMO` |

---

## Constantes (`src/lib/constants/ausentismos.ts`)

Todas las tablas de referencia del sistema de ausentismos. No dependen de base de datos.

| Constante | Contenido |
|-----------|-----------|
| `TIPOS_AUSENTISMO` | 7 tipos: 1=INCAPACIDADES, 2=ACCIDENTE, 3=MATERNIDAD, 4=PATERNIDAD, 5=LICENCIA_NO_REM, 6=LICENCIA, 7=SANCIÓN |
| `CLASES_AUSENTISMO` | 3 clases: 1=REMUNERADAS, 2=NO REMUNERADAS, 3=OTROS |
| `CAUSAS_AUSENTISMO` | 28 causas con códigos entre 1–50 (ej: 1=LIC REMUNERADA, 4=ENFERMEDAD GENERAL) |
| `CODIGOS_NOMINA` | 9 códigos de nómina: 11001–11004 (extras), 11501–11503 (recargos), 12530 (auxilio no prestacional) |
| `MESES_ABREVIADOS` | `['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']` |

---

## Rangos de quincena

| Quincena | Desde | Hasta |
|----------|-------|-------|
| 1 | Día 1 del mes, 00:00:00 UTC | Día 15 del mes, 23:59:59 UTC |
| 2 | Día 16 del mes, 00:00:00 UTC | Último día del mes, 23:59:59 UTC |

Los route handlers calculan estos rangos a partir de `anio`, `mes` y `quincena`. Todos los filtros de fecha se hacen en UTC (las jornadas y novedades se almacenan en UTC).

---

## Convención de formato de fechas

El manejo de fechas en los planos evita deliberadamente el constructor `new Date()` sobre strings ISO para prevenir desplazamiento de zona horaria.

| Hoja | Formato | Método |
|------|---------|--------|
| Hoja 1 (legible) — Cumpleaños / Otro | `MM/DD/YY` | Split del string ISO `YYYY-MM-DD`, recomposición manual |
| Hoja 2 (plano) — Cumpleaños / Otro | `ddMMyyyy` | Split del string ISO, sin separadores |
| Hoja 1 (legible) — Auxilio / Extras | `DD-MM-YYYY` | Split del string ISO |
| Hoja 2 (plano) — Auxilio / Extras | `ddMMyyyy` | Split del string ISO |

**Regla**: siempre partir del string ISO directamente. Nunca usar `new Date(isoString).toLocaleDateString()`.

---

## Plano 1: Cumpleaños

**Archivo**: `src/lib/excel/planos/cumpleanos.ts`  
**Ruta**: `GET /api/reportes/planos/cumpleanos?anio=X&mes=X&quincena=X`

### Fuente de datos

```sql
SELECT n.*, u.nombre, u.cedula
FROM novedades n
JOIN usuarios u ON u.cedula = n.empleado_id
WHERE n.tipo_novedad = 'DIA_CUMPLEANOS'
  AND n.fecha_novedad >= :inicio_quincena
  AND n.fecha_novedad <= :fin_quincena
```

### Hoja 1 — Formato legible

Bloque de encabezado con valores fijos en la parte superior:

| Campo | Valor fijo |
|-------|-----------|
| TIPO AUSENTISMO | 6 |
| NOMBRE TIPO AUSENTISMO | LICENCIA |
| CLASE AUSENTISMO | 1 |
| NOMBRE CLASE AUSENTISMO | REMUNERADAS |
| CAUSA AUSENTISMO | 1 |
| NOMBRE CAUSA AUSENTISMO | LIC REMUNERADA |
| PORCENTAJE | 0 |
| FORMA PAGO | BASICO |
| BASE LIQUIDACION | 0 |

Tabla de empleados con columnas:

| Columna | Contenido |
|---------|-----------|
| CODIGO EMPLEADO DESIGNER | cédula |
| DIAS AUSENTISMO | 1 (siempre) |
| FECHA INICIAL AUSENTISMO | `MM/DD/YY` de `fecha_novedad` |
| FECHA INICIAL PAGO AUSENTISMO | `MM/DD/YY` de `fecha_novedad` |
| DESCRIPCION | "DIA DE CUMPLEAÑOS" |

### Hoja 2 — Plano de importación

Sin encabezados. Columnas por posición:

| Pos | Contenido |
|-----|-----------|
| 1 | cédula |
| 2 | 6 (tipo ausentismo) |
| 3 | 1 (clase ausentismo) |
| 4 | 1 (causa ausentismo) |
| 5 | 1 (días) |
| 6–10 | fecha × 5 veces en formato `ddMMyyyy` |
| 11 | 0 (porcentaje) |
| 12 | vacío |
| 13 | BASICO |

---

## Plano 2: Auxilio No Prestacional

**Archivo**: `src/lib/excel/planos/auxilio.ts`  
**Ruta**: `GET /api/reportes/planos/auxilio?anio=X&mes=X&quincena=X`

### Fuente de datos

```sql
SELECT n.*, u.nombre, u.cedula
FROM novedades n
JOIN usuarios u ON u.cedula = n.empleado_id
WHERE n.tipo_novedad = 'AUXILIO_NO_PRESTACIONAL'
  AND n.fecha_novedad >= :inicio_quincena
  AND n.fecha_novedad <= :fin_quincena
```

### Documento soporte dinámico

`"AU NO PRE {quincena}{MES_ABREV}"` — ejemplo: `"AU NO PRE 1ENE"` para la primera quincena de enero.

### Periodicidad

| Quincena | Código periodicidad |
|----------|-------------------|
| 1 | 1-QUINCENAL |
| 2 | 2-QUINCENAL |

### Hoja 1 — Formato legible

Bloque de encabezado:

| Campo | Contenido |
|-------|-----------|
| FECHA INICIAL PERIODO | Día 1 o día 16, formato `DD-MM-YYYY` |
| FECHA FINAL PERIODO | Día 15 o último día del mes, formato `DD-MM-YYYY` |
| DOCUMENTO SOPORTE | `"AU NO PRE {quincena}{MES_ABREV}"` |
| PERIODICIDAD | `1-QUINCENAL` o `2-QUINCENAL` |
| TIPO NOVEDAD | `OCASIONAL` |

Tabla lateral de referencia con todos los `CODIGOS_NOMINA`.

Tabla de empleados:

| Columna | Contenido |
|---------|-----------|
| CEDULA | cédula |
| CONCEPTO | 12530 |
| VALOR | `valor_monetario` de la novedad |
| SALDO | vacío |
| NIT | vacío |
| HORAS | vacío |
| MINUTOS | vacío |
| DESCRIPCION | "AUX NO PRESTACIONAL" |

### Hoja 2 — Plano de importación

Sin encabezados. Columnas por posición:

| Pos | Contenido |
|-----|-----------|
| 1 | 12530 (código nómina) |
| 2 | cédula |
| 3 | fecha_inicio en `ddMMyyyy` |
| 4 | fecha_fin en `ddMMyyyy` |
| 5 | fecha_inicio en `ddMMyyyy` |
| 6 | doc_soporte |
| 7 | valor monetario |
| 8 | periodicidad numérica (6 para 1Q, 4 para 2Q) |
| 9 | 0 |
| 10–12 | vacío |
| 13 | OCASIONAL |

---

## Plano 3: Horas Extras

**Archivo**: `src/lib/excel/planos/extras.ts`  
**Ruta**: `GET /api/reportes/planos/extras?anio=X&mes=X&quincena=X`

### Fuente de datos

```sql
-- Jornadas cerradas en la quincena
SELECT j.*, u.nombre, u.cedula
FROM jornadas j
JOIN usuarios u ON u.cedula = j.empleado_id
WHERE j.estado IN ('CERRADO', 'CERRADO_MANUAL')
  AND j.entrada >= :inicio_utc
  AND j.entrada <= :fin_utc

-- Aprobaciones para filtrar extras
SELECT ae.jornada_id, ae.estado
FROM aprobaciones_extras ae
WHERE ae.jornada_id = ANY(:ids_jornadas)
```

### Lógica de agregación por empleado

Los minutos se acumulan por empleado y código de nómina:

| Código | Tipo | Condición de inclusión |
|--------|------|------------------------|
| 11001 | Extra Diurna | Solo si la jornada tiene aprobación `APROBADA` |
| 11002 | Extra Nocturna | Solo si la jornada tiene aprobación `APROBADA` |
| 11003 | Extra Festiva/Dom Diurna | Solo si la jornada tiene aprobación `APROBADA` |
| 11004 | Extra Festiva/Dom Nocturna | Solo si la jornada tiene aprobación `APROBADA` |
| 11501 | Recargo Nocturno | Siempre incluido |
| 11502 | Recargo Festivo Diurno | Siempre incluido. Incluye `minutos_domingos` sumados aquí |
| 11503 | Recargo Festivo Nocturno | Siempre incluido |

Los minutos acumulados se convierten a horas + minutos restantes para las columnas del plano.

### Documento soporte dinámico

`"EXT {quincena}Q {MES_ABREV}"` — ejemplo: `"EXT 2Q ENE"` para la segunda quincena de enero.

### Hoja 1 — Formato legible

Mismo bloque de encabezado que Auxilio (con el doc_soporte de extras). Tabla de empleados:

| Columna | Contenido |
|---------|-----------|
| CEDULA | cédula |
| CONCEPTO | código de nómina (11001–11503) |
| VALOR | vacío |
| SALDO | vacío |
| NIT | vacío |
| HORAS | horas enteras acumuladas |
| MINUTOS | minutos restantes |
| DESCRIPCION | etiqueta del código (ej: "H.E.D") |

Una fila por empleado por código. Solo se incluyen filas con minutos > 0.

### Hoja 2 — Plano de importación

Sin encabezados. Misma estructura que Auxilio pero con horas/minutos en lugar de valor:

| Pos | Contenido |
|-----|-----------|
| 1 | código nómina |
| 2 | cédula |
| 3 | fecha_inicio quincena en `ddMMyyyy` |
| 4 | fecha_fin quincena en `ddMMyyyy` |
| 5 | fecha_inicio quincena en `ddMMyyyy` |
| 6 | doc_soporte |
| 7 | vacío (valor) |
| 8 | periodicidad numérica (6 para 1Q, 4 para 2Q) |
| 9 | 0 |
| 10 | vacío |
| 11 | horas |
| 12 | minutos |
| 13 | OCASIONAL |

---

## Plano 4: Otro (por ausentismo)

**Archivo**: `src/lib/excel/planos/otro.ts`  
**Ruta**: `GET /api/reportes/planos/otro?anio=X&mes=X&quincena=X&tipo=X&clase=X&causa=X`

### Fuente de datos

```sql
SELECT n.*, u.nombre, u.cedula
FROM novedades n
JOIN usuarios u ON u.cedula = n.empleado_id
WHERE n.tipo_ausentismo = :tipo
  AND n.codigo_causa = :causa
  AND (
    -- Novedades de un solo día
    (n.fecha_novedad >= :inicio AND n.fecha_novedad <= :fin)
    OR
    -- Novedades con rango de fechas que se superponga con la quincena
    (n.fecha_inicio <= :fin AND n.fecha_fin >= :inicio)
  )
```

La clase seleccionada (`es_pagado`) se usa para determinar el valor del campo clase en la hoja 2, según lo registrado en cada novedad.

### Cálculo de días

- Si la novedad tiene `fecha_inicio` y `fecha_fin`: `dias = fecha_fin - fecha_inicio + 1`
- Si la novedad tiene solo `fecha_novedad`: `dias = 1`

### Hoja 1 — Formato legible

Bloque de encabezado con los códigos y nombres de tipo, clase y causa seleccionados. Tabla de empleados con las mismas columnas que el plano de Cumpleaños pero con los valores dinámicos (tipo, clase, causa).

### Hoja 2 — Plano de importación

Misma estructura que Cumpleaños pero con valores dinámicos por fila:

| Pos | Contenido |
|-----|-----------|
| 1 | cédula |
| 2 | tipo ausentismo seleccionado |
| 3 | clase ausentismo (de `es_pagado` de la novedad) |
| 4 | causa ausentismo seleccionada |
| 5 | días calculados |
| 6–10 | fechas × 5: fecha_inicio como `ddMMyyyy`; fecha_fin = fecha_inicio + días - 1 |
| 11 | 0 (porcentaje) |
| 12 | vacío |
| 13 | BASICO |

---

## Tabla de archivos

| Archivo | Propósito |
|---------|-----------|
| `src/lib/constants/ausentismos.ts` | Todas las tablas de códigos de ausentismo y nómina |
| `src/lib/excel/planos/cumpleanos.ts` | Generador del plano de cumpleaños |
| `src/lib/excel/planos/auxilio.ts` | Generador del plano de auxilio no prestacional |
| `src/lib/excel/planos/extras.ts` | Generador del plano de horas extras |
| `src/lib/excel/planos/otro.ts` | Generador del plano genérico de ausentismo |
| `src/app/api/reportes/planos/cumpleanos/route.ts` | Route handler — plano de cumpleaños |
| `src/app/api/reportes/planos/auxilio/route.ts` | Route handler — plano de auxilio |
| `src/app/api/reportes/planos/extras/route.ts` | Route handler — plano de horas extras |
| `src/app/api/reportes/planos/otro/route.ts` | Route handler — plano de otro ausentismo |
| `src/components/ExportPlanosDialog.tsx` | Diálogo de selección en el dashboard |

---

## Consideraciones de mantenimiento

### Agregar un nuevo tipo de plano

1. Agregar la constante correspondiente en `src/lib/constants/ausentismos.ts` si se requieren nuevos códigos.
2. Crear `src/lib/excel/planos/{nuevo}.ts` con la función generadora.
3. Crear `src/app/api/reportes/planos/{nuevo}/route.ts` que llame al generador y retorne el buffer.
4. Agregar la opción en `ExportPlanosDialog.tsx`.

### Cambiar el formato de una columna

Editar únicamente el archivo del generador en `src/lib/excel/planos/`. Los route handlers no contienen lógica de formato.

### Cambiar los códigos de nómina

Editar `src/lib/constants/ausentismos.ts`. Los generadores importan las constantes directamente; no hay valores hardcoded en los generadores.

### Depuración de fechas incorrectas

Verificar siempre que el string de fecha se esté partiendo directamente (`split('-')`) sin pasar por el constructor `Date`. Un `new Date('2026-01-15')` en Node.js puede resolverse en UTC−5 y retornar el día anterior.

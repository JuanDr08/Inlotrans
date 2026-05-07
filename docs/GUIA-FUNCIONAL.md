# Inlotrans Asistencia — Guía Funcional

Esta guía explica cómo funciona el sistema de asistencia de Inlotrans desde el punto de vista del usuario: qué hace cada módulo, cómo se conectan entre sí y qué significan los conceptos clave.

---

## Roles del sistema

### Trabajador (empleado)
No tiene cuenta en el sistema. Solo interactúa con el **quiosco** usando su número de cédula. Marca entrada al llegar y salida al irse.

### Coordinador
Tiene cuenta con email y contraseña. Ve únicamente los datos de **su operación** (centro de trabajo asignado). Puede:
- Ver las jornadas de sus empleados
- Aprobar o rechazar horas extras
- Corregir jornadas inconsistentes (que no se cerraron)
- Registrar novedades (incapacidades, permisos, compensaciones)

### Administrador
Acceso total a todo el sistema. Puede hacer lo mismo que el coordinador pero para **todas las operaciones**, además de:
- Crear y editar operaciones (centros de trabajo)
- Gestionar usuarios del sistema (otros admins y coordinadores)
- Descargar reportes Excel de nómina
- Ver el reporte administrativo global

---

## Módulos del sistema

### 1. Quiosco (pantalla principal)

Es la primera pantalla que aparece. Funciona así:

1. El empleado ingresa su **cédula**.
2. El sistema busca al empleado y muestra su nombre automáticamente.
3. Si el empleado **no tiene jornada activa**, aparece el botón **ENTRADA**.
4. Si el empleado **ya marcó entrada** y tiene jornada activa, aparece el botón **SALIDA**.
5. El empleado toma una **foto** (obligatoria como evidencia, pero no se almacena en la BD).
6. Selecciona la **operación** donde está trabajando.
7. Confirma el registro.

Al marcar **ENTRADA**: se crea una jornada en estado ABIERTO con la hora actual.

Al marcar **SALIDA**: se ejecuta el motor de liquidación que calcula automáticamente todas las horas trabajadas, descuenta el almuerzo si aplica, detecta extras, ajusta la bolsa de horas y genera alertas si es necesario.

Si el empleado tiene **jornadas inconsistentes** (que nunca cerró), aparece un banner amarillo de advertencia.

---

### 2. Jornadas

Una **jornada** es un turno completo de trabajo: desde que el empleado marca ENTRADA hasta que marca SALIDA. Es la unidad central de todo el sistema.

#### Estados de una jornada

| Estado | Significado |
|--------|------------|
| **ABIERTO** | El empleado marcó entrada pero aún no ha marcado salida. Normal durante su turno de trabajo. |
| **CERRADO** | El empleado marcó salida. El sistema ya calculó todas las horas. |
| **CERRADO_MANUAL** | Un coordinador corrigió la jornada que estaba inconsistente, ingresando la hora de salida real. |
| **INCONSISTENTE** | Pasaron más de 16 horas desde la entrada sin que el empleado marcara salida. El CRON nocturno la detectó y la marcó para que el coordinador la revise. |

#### Qué pasa al cerrar una jornada

Cuando se cierra (automáticamente o por el coordinador), el sistema ejecuta estos pasos:

1. **Descuento de almuerzo**: si la operación tiene almuerzo configurado (ej: 60 minutos) y la jornada duró más de 5 horas, se descuenta automáticamente.
2. **Clasificación de horas**: cada minuto trabajado se clasifica en uno de los 9 tipos de hora (normal, nocturna, extra, festiva, etc.) según la ley colombiana.
3. **Alerta crítica**: si la jornada superó las 12 horas, se genera una alerta.
4. **Horas extras**: si trabajó más de 8 horas, el excedente:
   - Primero, se usa para **pagar deudas** en la bolsa de horas (si la tiene negativa).
   - Lo que sobra, se envía a **aprobaciones pendientes** para que el coordinador apruebe.
5. **Déficit**: si trabajó menos de 8 horas y no tiene una novedad remunerada que cubra ese día, se descuenta de la bolsa de horas (genera deuda).

---

### 3. Operaciones

Una **operación** es un centro de trabajo o punto de servicio donde los empleados laboran. Ejemplos: "Pepsico funza", "Administrativo B9", "Pepsico maquila".

Cada operación tiene:
- **Código** (INL-XXXX): identificador único para reportes de nómina y contabilidad.
- **Nombre**: nombre descriptivo del centro.
- **Límite de jornada**: 8 o 12 horas (por defecto 8h, que es el estándar legal colombiano).
- **Minutos de almuerzo**: cuántos minutos se descuentan automáticamente si la jornada supera las 5 horas (por defecto 60 min).
- **Máximo extras por día**: cuántas horas extra están permitidas por día.
- **Estado**: activa o inactiva. Las inactivas no aparecen en el quiosco.

Los **turnos** son horarios definidos por operación (ej: "Turno Mañana 06:00-14:00"). Por ahora son informativos — el motor de liquidación no los usa para calcular.

---

### 4. Bolsa de horas

Cada empleado tiene una **bolsa de horas** que funciona como un saldo:

- **Saldo positivo** (+): el empleado tiene horas a favor. Esto pasa cuando trabaja excedente que se abona a la bolsa (por ejemplo, si tenía deuda y la saldó con horas extra, o si una novedad de tipo COMPENSA_TIEMPO le restó saldo previamente).
- **Saldo negativo** (-): el empleado tiene una deuda de horas. Esto pasa cuando:
  - Trabajó menos de 8 horas en un día sin justificación (novedad remunerada).
  - Se le descontaron horas por algún motivo.
- **Saldo cero** (0): está al día.

#### Cómo se mueve la bolsa

| Evento | Efecto en la bolsa |
|--------|-------------------|
| Empleado trabaja 7h (1h menos sin novedad) | -60 min (deuda) |
| Empleado trabaja 10h con deuda de -60 min | +60 min se abona a la deuda (queda en 0), las otras 60 min van a aprobación de extras |
| Coordinador registra COMPENSA_TIEMPO de 4h | -240 min (el empleado "se toma" esas horas usando su saldo) |
| Empleado trabaja 10h sin deuda | 120 min van directo a aprobación de extras (la bolsa no se toca) |

Cada movimiento queda registrado en la tabla `movimientos_bolsa` con el saldo antes, saldo después, motivo y nota — para trazabilidad total.

---

### 5. Aprobaciones de horas extras

**Toda hora extra trabajada (por encima de las 8h) requiere la aprobación del coordinador.** No se paga automáticamente.

Cuando un empleado genera extras, se crea una solicitud con estado **PENDIENTE**. El coordinador la ve en el **Panel de Control** (/aprobaciones) y puede:
- **Aprobar**: las horas se incluirán en la nómina.
- **Rechazar**: las horas se descartan. Debe escribir una nota explicando por qué.

El sistema siempre prioriza sanear la bolsa de horas antes de generar aprobaciones. Si un empleado tiene deuda de 2h y trabaja 3h extra, solo 1h va a aprobación (las otras 2h pagan la deuda).

---

### 6. Novedades

Las **novedades** son eventos que el coordinador registra manualmente para un empleado. Cubren situaciones que no se capturan con la marcación del quiosco:

| Tipo | Ejemplo |
|------|---------|
| INCAPACIDAD | Enfermedad general, accidente laboral |
| INCAPACIDAD_ARL | Riesgo laboral |
| AUSENTISMO | Faltó sin justificación |
| PERMISO | Permiso autorizado |
| SANCIÓN | Suspensión disciplinaria |
| VACACIONES | Período de vacaciones |
| LIC_LUTO / LIC_MATERNIDAD / LIC_REMUNERADA / LIC_NO_REMUNERADA | Licencias legales |
| DIA_CUMPLEANOS / DIA_FAMILIA | Días especiales de la empresa |
| COMPENSA_TIEMPO | El empleado usa horas de su bolsa para tomarse tiempo libre |
| PAGA_TIEMPO | Pago de horas extras acumuladas |
| GANA_DOMINGO / NO_GANA_DOMINGO | Marcación manual del pago de domingo |
| GANA_FESTIVO | Marcación de pago festivo |
| TRASLADO / INGRESO_NUEVO / RETIRO | Movimientos de personal |
| FIN_TURNO_NOCHE / FIN_TURNO_DIA | Fin de turno administrativo |

#### Propiedad "Es remunerada" (es_pagado)

Cada novedad tiene un campo **"¿Es remunerada?"**:
- **Sí**: las horas de ese día (8h por defecto) **suman para el cumplimiento semanal de las 44 horas**. Es decir, el empleado no pierde el derecho al pago del domingo aunque no haya trabajado ese día.
- **No**: no suma. Si el empleado no completó las 44h con otros días, pierde el domingo.

#### COMPENSA_TIEMPO (caso especial)

Cuando un coordinador registra una novedad de tipo **COMPENSA_TIEMPO**, debe ingresar cuántas horas se va a tomar el empleado. Esas horas se **restan automáticamente de la bolsa** y **cuentan como remuneradas** para el cumplimiento de las 44h.

Ejemplo: si un empleado tiene +8h en la bolsa y el coordinador registra COMPENSA_TIEMPO de 4h, la bolsa pasa de +8h a +4h, y ese día le cuenta como si hubiera trabajado 4h para el cálculo del domingo.

---

### 7. Alertas

El sistema genera alertas automáticas que aparecen en el dashboard del coordinador y en el detalle de cada empleado:

| Tipo | Cuándo se genera | Acción requerida |
|------|-----------------|------------------|
| **INCONSISTENTE** | El CRON detecta una jornada abierta por más de 16 horas | Coordinador ingresa hora de salida real desde /aprobaciones |
| **ALERTA_CRITICA** | Al cerrar una jornada que superó las 12 horas | Verificar que el turno fue real (puede ser un error de marcación) |
| **EXTRAS_PENDIENTES** | Al cerrar una jornada con horas extra | Coordinador aprueba o rechaza las horas desde /aprobaciones |

Las alertas se muestran como banners de color en el detalle del empleado y como contadores en el Panel de Control.

---

### 8. Cumplimiento semanal (Ley 44 horas)

En Colombia, para que un empleado gane el pago del día domingo, debe cumplir la **jornada semanal pactada de 44 horas** (de lunes a domingo).

El sistema calcula esto automáticamente cada lunes a las 19:00 hora Colombia (CRON diario). Para el cálculo:

**Horas que SÍ suman**:
- Horas ordinarias trabajadas (normales + nocturnas + domingos + festivos + dom/fest nocturnos)
- Días con novedad remunerada × 8 horas

**Horas que NO suman**:
- Horas extra (ya son un pago adicional, no cuentan para las 44h base)
- Novedades no remuneradas

**Resultado**:
- Si total ≥ 44h → `paga_domingo = true` (el empleado gana el domingo)
- Si total < 44h → `paga_domingo = false` (no gana el domingo)

Esto se muestra en el detalle del empleado como una **barra de progreso** con el porcentaje de cumplimiento.

---

### 9. Reporte administrativo

La sección de **Administración** muestra un resumen general con:

- **Filtros**: período (quincenal/semanal/mensual/personalizado), rango de fechas, y filtro por operaciones.
- **KPIs globales**: empleados con jornadas, horas liquidadas, valor total, operaciones filtradas.
- **Tablas por período**: cada grupo (quincena, semana, etc.) lista a cada empleado con sus horas totales, desglose de recargos (badges de color por tipo) y valor monetario.

Desde esta misma pantalla se puede **descargar el Excel de nómina** (botón verde "Nómina") usando el rango de fechas seleccionado.

---

### 10. Excel de nómina

El reporte Excel genera un archivo `.xlsx` con el formato que usa contabilidad para la liquidación de nómina. Cada línea representa **1 empleado × 1 día**:

| Columna | Contenido |
|---------|-----------|
| FECHA | Día de la jornada (fecha de entrada) |
| CARGO | Cargo del empleado |
| CEDULA | Número de cédula |
| NOMBRE | Nombre completo (apellidos y nombre) |
| IN | Hora de entrada (entera, formato 24h) |
| OUT | Hora de salida (entera) |
| ALMU | Horas de almuerzo descontadas |
| HORAS | Total = OUT - IN (consistente con las columnas anteriores) |
| H.E.D | Horas Extra Diurnas |
| H.E.N | Horas Extra Nocturnas |
| E.F.D | Extra Festiva/Dominical Diurna |
| E.F.N | Extra Festiva/Dominical Nocturna |
| R.N | Recargo Nocturno |
| R.F.N | Recargo Festivo Nocturno |
| R.F | Recargo Festivo/Dominical |
| OPERACIÓN | Nombre de la operación |
| CENTRO DE COSTO | Código INL-XXXX |
| NOVEDAD | Tipo de novedad (si aplica) |
| DETALLE NOVEDAD | Descripción de la novedad |

**Al final del archivo** hay una tabla de totales con:
- Subtotales de cada columna de horas
- Código de nómina de cada tipo de hora (11001, 11002, etc.)
- Valor por hora de cada tipo (tomado de la tabla de tarifas)
- Total = horas × valor
- Porcentaje de cada recargo sobre la hora normal
- Salario base mensual y valor de la hora normal (salario ÷ 220h)

Si un empleado tiene **más de una novedad el mismo día**, aparece una fila duplicada con la misma información de jornada pero con la novedad diferente.

Si un empleado tiene **novedad pero no trabajó ese día** (ej: incapacidad), aparece una fila con IN=0, OUT=0, HORAS=0 y solo la novedad.

---

### 11. CRON nocturno (proceso automático)

Todos los días a las **19:00 hora Colombia** (medianoche UTC), el sistema ejecuta automáticamente:

1. **Detección de inconsistencias**: busca todas las jornadas que llevan más de 16 horas abiertas sin que el empleado haya marcado salida. Las marca como INCONSISTENTE y genera una alerta para que el coordinador las revise.

2. **Cierre dominical** (solo los lunes): si ayer fue domingo, calcula el cumplimiento de las 44h de la semana que acaba de terminar (lunes a domingo) para cada empleado activo. Registra si gana o no el domingo.

Este proceso corre solo — no requiere intervención humana. El coordinador solo necesita revisar las jornadas inconsistentes que aparezcan en su panel.

---

## Flujo típico de un día de trabajo

```
06:00  Empleado llega al quiosco
       → Ingresa cédula → toma foto → marca ENTRADA
       → Sistema crea jornada ABIERTO

12:00  (Almuerzo — NO se marca en el sistema)
       → Se descuenta automáticamente al cerrar si jornada > 5h

14:30  Empleado se va
       → Ingresa cédula → toma foto → marca SALIDA
       → Sistema ejecuta motor de liquidación:
         • Entrada 06:00, Salida 14:30 = 8.5h brutas
         • Almuerzo 60min descontado = 7.5h efectivas
         • Todo ordinario (día normal, diurno, <8h)
         • Déficit de 30 minutos → se descuenta de bolsa
         • Sin extras → sin aprobación

19:00  CRON se ejecuta automáticamente
       → Si el empleado olvidó marcar salida (lleva >16h), lo marca INCONSISTENTE
       → Si ayer fue domingo, calcula las 44h de la semana

Siguiente día:
       → Coordinador ve en /aprobaciones si hay inconsistentes o extras pendientes
       → Resuelve cada caso
```

---

## Glosario rápido

| Término | Significado |
|---------|------------|
| Jornada | Un turno completo de trabajo (entrada → salida) |
| Snapshot | Los 9 tipos de minutos que se guardan al cerrar una jornada |
| Bolsa | Saldo de horas compensatorias de un empleado (+/-) |
| Excedente | Horas trabajadas por encima de las 8h |
| Déficit | Horas faltantes por debajo de las 8h |
| Liquidación | Proceso de calcular y clasificar las horas al cerrar una jornada |
| Operación | Centro de trabajo con sus propias reglas (límite, almuerzo) |
| Novedad | Evento registrado manualmente (incapacidad, permiso, compensación) |
| Remunerada | Novedad que cuenta como horas trabajadas para el domingo |
| 44h | Jornada semanal pactada en Colombia para ganar el pago del domingo |
| INCONSISTENTE | Jornada que lleva >16h abierta sin cerrar |
| CRON | Proceso automático que corre cada noche sin intervención |

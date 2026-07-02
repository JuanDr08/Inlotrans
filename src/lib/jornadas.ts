import { getD1, getKV, generateId } from '@/lib/d1/client'
import {
    calcularPeriodosHorasOptimizado,
    obtenerFestivosParaRango,
    redondearMediaHora,
    toColombiaTime,
    type PeriodosHoras,
} from '@/lib/calculoHoras'

// ==================================================
// TIPOS
// ==================================================

export type EstadoJornada = 'ABIERTO' | 'CERRADO' | 'CERRADO_MANUAL' | 'INCONSISTENTE'
export type EstadoAprobacion = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA'
export type TipoAlerta = 'INCONSISTENTE' | 'ALERTA_CRITICA' | 'EXTRAS_PENDIENTES'
export type TipoMovimiento =
    | 'ABONO_EXCEDENTE'
    | 'CARGO_DEFICIT'
    | 'NOVEDAD_COMPENSA'
    | 'AJUSTE_MANUAL'

export interface Jornada {
    id: string
    empleado_id: string
    operacion: string
    entrada: string
    salida: string | null
    estado: EstadoJornada
    minutos_normales: number
    minutos_nocturnas: number
    minutos_domingos: number
    minutos_festivos: number
    minutos_domingos_festivos_nocturnos: number
    minutos_extras_ordinarias: number
    minutos_extras_nocturnas: number
    minutos_extras_dominical_festivo: number
    minutos_extras_nocturna_dominical_festivo: number
    minutos_total: number
    minutos_almuerzo_descontados: number
    cerrada_por: 'empleado' | 'coordinador' | 'cron' | null
    hora_salida_manual: string | null
    alerta_critica: boolean
    created_at: string
    updated_at: string
}

export interface SnapshotMinutos {
    minutos_normales: number
    minutos_nocturnas: number
    minutos_domingos: number
    minutos_festivos: number
    minutos_domingos_festivos_nocturnos: number
    minutos_extras_ordinarias: number
    minutos_extras_nocturnas: number
    minutos_extras_dominical_festivo: number
    minutos_extras_nocturna_dominical_festivo: number
    minutos_total: number
    minutos_almuerzo_descontados: number
}

type Resultado<T> = { data: T | null; error: string | null }

const KV_CONFIG_OPERACION_TTL = 300 // 5 min in seconds

// ==================================================
// HELPERS
// ==================================================

function periodosASnapshot(p: PeriodosHoras, minutosAlmuerzoDescontados: number): SnapshotMinutos {
    const minutos_normales = redondearMediaHora(p.minutosNormales)
    const minutos_nocturnas = redondearMediaHora(p.minutosNocturnas)
    const minutos_domingos = redondearMediaHora(p.minutosDomingos)
    const minutos_festivos = redondearMediaHora(p.minutosFestivos)
    const minutos_domingos_festivos_nocturnos = redondearMediaHora(p.minutosDomingosFestivosNocturnos)
    const minutos_extras_ordinarias = redondearMediaHora(p.minutosExtrasOrdinarias)
    const minutos_extras_nocturnas = redondearMediaHora(p.minutosExtrasNocturnas)
    const minutos_extras_dominical_festivo = redondearMediaHora(p.minutosExtrasDominicalFestivo)
    const minutos_extras_nocturna_dominical_festivo = redondearMediaHora(p.minutosExtrasNocturnaDominicalFestivo)

    return {
        minutos_normales,
        minutos_nocturnas,
        minutos_domingos,
        minutos_festivos,
        minutos_domingos_festivos_nocturnos,
        minutos_extras_ordinarias,
        minutos_extras_nocturnas,
        minutos_extras_dominical_festivo,
        minutos_extras_nocturna_dominical_festivo,
        minutos_total:
            minutos_normales +
            minutos_nocturnas +
            minutos_domingos +
            minutos_festivos +
            minutos_domingos_festivos_nocturnos +
            minutos_extras_ordinarias +
            minutos_extras_nocturnas +
            minutos_extras_dominical_festivo +
            minutos_extras_nocturna_dominical_festivo,
        minutos_almuerzo_descontados: minutosAlmuerzoDescontados,
    }
}

/**
 * Calcula el snapshot de minutos efectivos trabajados entre entrada y salida,
 * aplicando descuento de almuerzo si corresponde. Input en UTC (Date original).
 */
async function calcularSnapshot(
    entradaUTC: Date,
    salidaUTC: Date,
    minutosAlmuerzoConfig: number,
): Promise<SnapshotMinutos> {
    const minutosBrutos = Math.floor((salidaUTC.getTime() - entradaUTC.getTime()) / 60000)

    // Descuento de almuerzo: solo si config > 0 Y jornada > 5h
    const aplicaAlmuerzo = minutosAlmuerzoConfig > 0 && minutosBrutos > 300
    const minutosAlmuerzoDescontados = aplicaAlmuerzo ? minutosAlmuerzoConfig : 0

    // Salida efectiva para el motor (se corta la "cola" correspondiente al almuerzo).
    // Con este criterio se clasifican correctamente las últimas horas del turno:
    // si el almuerzo se tomó "al final" o distribuido, el efecto neto es el mismo en total.
    const salidaEfectivaUTC = aplicaAlmuerzo
        ? new Date(salidaUTC.getTime() - minutosAlmuerzoConfig * 60000)
        : salidaUTC

    // Una sola conversión a Colombia — el motor espera fechas "Bogotá falsas"
    const entradaBog = toColombiaTime(entradaUTC)
    const salidaBog = toColombiaTime(salidaEfectivaUTC)

    const festivos = await obtenerFestivosParaRango(entradaUTC, salidaEfectivaUTC)
    const periodos = calcularPeriodosHorasOptimizado(entradaBog, salidaBog, festivos, 0)

    return periodosASnapshot(periodos, minutosAlmuerzoDescontados)
}

async function obtenerConfigOperacion(
    db: any,
    nombre: string,
): Promise<{ limite_horas: number; minutos_almuerzo: number }> {
    const kv = getKV()
    const kvKey = `config:operacion:${nombre}`

    const cached = await kv.get(kvKey, 'json') as { limite_horas: number; minutos_almuerzo: number } | null
    if (cached) return cached

    const data = await db
        .prepare('SELECT limite_horas, minutos_almuerzo FROM operaciones WHERE nombre = ?')
        .bind(nombre)
        .first() as { limite_horas: number; minutos_almuerzo: number } | null

    const config = {
        limite_horas: data?.limite_horas ?? 8,
        minutos_almuerzo: data?.minutos_almuerzo ?? 0,
    }

    await kv.put(kvKey, JSON.stringify(config), { expirationTtl: KV_CONFIG_OPERACION_TTL })
    return config
}

async function obtenerSaldoBolsa(
    db: any,
    empleadoId: string,
): Promise<number> {
    const data = await db
        .prepare('SELECT saldo_minutos FROM bolsa_horas WHERE empleado_id = ?')
        .bind(empleadoId)
        .first() as { saldo_minutos: number } | null
    return data?.saldo_minutos ?? 0
}

async function registrarMovimientoBolsa(
    db: any,
    params: {
        empleadoId: string
        minutos: number
        motivo: TipoMovimiento
        saldoAntes: number
        saldoDespues: number
        jornadaId?: string
        novedadId?: string
        nota?: string
    },
): Promise<void> {
    const ahora = new Date().toISOString()

    // Atomic upsert — fixes race condition from the SELECT→INSERT/UPDATE pattern
    await db
        .prepare(
            `INSERT INTO bolsa_horas (empleado_id, saldo_minutos, updated_at)
             VALUES (?, ?, ?)
             ON CONFLICT(empleado_id) DO UPDATE SET saldo_minutos = ?, updated_at = ?`,
        )
        .bind(params.empleadoId, params.saldoDespues, ahora, params.saldoDespues, ahora)
        .run()

    await db
        .prepare(
            `INSERT INTO movimientos_bolsa (id, empleado_id, jornada_id, novedad_id, minutos, motivo, saldo_antes, saldo_despues, nota)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
            generateId(),
            params.empleadoId,
            params.jornadaId ?? null,
            params.novedadId ?? null,
            params.minutos,
            params.motivo,
            params.saldoAntes,
            params.saldoDespues,
            params.nota ?? null,
        )
        .run()
}

/**
 * ¿Existe una novedad remunerada que cubra la fecha de la jornada?
 * fechaJornada en formato YYYY-MM-DD (hora Colombia).
 */
async function hayNovedadRemuneradaParaFecha(
    db: any,
    empleadoId: string,
    fechaJornada: string,
): Promise<boolean> {
    const data = await db
        .prepare(
            `SELECT id FROM novedades
             WHERE usuario_id = ? AND es_pagado = 1
               AND (fecha_novedad = ? OR (fecha_inicio <= ? AND fecha_fin >= ?))
             LIMIT 1`,
        )
        .bind(empleadoId, fechaJornada, fechaJornada, fechaJornada)
        .first() as { id: string } | null
    return !!data
}

function fechaColombiaYYYYMMDD(fechaUTC: Date): string {
    const col = toColombiaTime(fechaUTC)
    return `${col.getUTCFullYear()}-${String(col.getUTCMonth() + 1).padStart(2, '0')}-${String(col.getUTCDate()).padStart(2, '0')}`
}

// ==================================================
// API PÚBLICA
// ==================================================

/**
 * Crea una nueva jornada en estado ABIERTO. Falla si el empleado ya tiene
 * una jornada abierta (garantizado también por unique index parcial en DB).
 */
export async function abrirJornada(
    cedula: string,
    operacion: string,
): Promise<Resultado<Jornada>> {
    const db = getD1()

    const activa = await db
        .prepare("SELECT id FROM jornadas WHERE empleado_id = ? AND estado = 'ABIERTO'")
        .bind(cedula)
        .first() as { id: string } | null
    if (activa) return { data: null, error: 'Ya existe una jornada activa para este empleado.' }

    const id = generateId()
    const ahora = new Date().toISOString()

    await db
        .prepare(
            `INSERT INTO jornadas (id, empleado_id, operacion, entrada, estado, created_at, updated_at)
             VALUES (?, ?, ?, ?, 'ABIERTO', ?, ?)`,
        )
        .bind(id, cedula, operacion, ahora, ahora, ahora)
        .run()

    const data: Jornada = {
        id,
        empleado_id: cedula,
        operacion,
        entrada: ahora,
        salida: null,
        estado: 'ABIERTO',
        minutos_normales: 0,
        minutos_nocturnas: 0,
        minutos_domingos: 0,
        minutos_festivos: 0,
        minutos_domingos_festivos_nocturnos: 0,
        minutos_extras_ordinarias: 0,
        minutos_extras_nocturnas: 0,
        minutos_extras_dominical_festivo: 0,
        minutos_extras_nocturna_dominical_festivo: 0,
        minutos_total: 0,
        minutos_almuerzo_descontados: 0,
        cerrada_por: null,
        hora_salida_manual: null,
        alerta_critica: false,
        created_at: ahora,
        updated_at: ahora,
    }

    return { data, error: null }
}

/**
 * Cierra la jornada ABIERTO del empleado, ejecuta el motor de liquidación,
 * actualiza bolsa y genera aprobaciones/alertas si corresponde.
 */
export async function cerrarJornada(
    cedula: string,
    salidaTimestamp?: Date,
): Promise<Resultado<Jornada>> {
    const db = getD1()
    const salida = salidaTimestamp ?? new Date()

    const jornada = await db
        .prepare("SELECT * FROM jornadas WHERE empleado_id = ? AND estado = 'ABIERTO'")
        .bind(cedula)
        .first() as Jornada | null
    if (!jornada) return { data: null, error: 'No existe jornada activa para este empleado.' }

    const config = await obtenerConfigOperacion(db, jornada.operacion)
    const entrada = new Date(jornada.entrada)
    const snapshot = await calcularSnapshot(entrada, salida, config.minutos_almuerzo)

    const jornadaActualizada = await liquidarJornada(db, {
        jornada,
        snapshot,
        salida,
        limiteHoras: config.limite_horas,
        cerradaPor: 'empleado',
        estadoFinal: 'CERRADO',
    })

    return { data: jornadaActualizada, error: null }
}

/**
 * Coordinador corrige una jornada INCONSISTENTE. Ingresa la hora de salida real,
 * el motor recalcula y se ejecuta la liquidación como si hubiera cerrado normal.
 */
export async function corregirJornadaInconsistente(
    jornadaId: string,
    horaSalidaReal: Date,
): Promise<Resultado<Jornada>> {
    const db = getD1()

    const jornada = await db
        .prepare("SELECT * FROM jornadas WHERE id = ? AND estado = 'INCONSISTENTE'")
        .bind(jornadaId)
        .first() as Jornada | null
    if (!jornada) return { data: null, error: 'Jornada no encontrada o no está INCONSISTENTE.' }

    const config = await obtenerConfigOperacion(db, jornada.operacion)
    const entrada = new Date(jornada.entrada)
    const snapshot = await calcularSnapshot(entrada, horaSalidaReal, config.minutos_almuerzo)

    const jornadaActualizada = await liquidarJornada(db, {
        jornada,
        snapshot,
        salida: horaSalidaReal,
        limiteHoras: config.limite_horas,
        cerradaPor: 'coordinador',
        estadoFinal: 'CERRADO_MANUAL',
        horaSalidaManual: horaSalidaReal,
    })

    // Marcar alertas INCONSISTENTE de esta jornada como leídas
    await db
        .prepare("UPDATE alertas SET leida = 1 WHERE jornada_id = ? AND tipo = 'INCONSISTENTE'")
        .bind(jornadaId)
        .run()

    return { data: jornadaActualizada, error: null }
}

// ==================================================
// MOTOR DE LIQUIDACIÓN (interno)
// ==================================================

interface LiquidarArgs {
    jornada: Jornada
    snapshot: SnapshotMinutos
    salida: Date
    limiteHoras: number
    cerradaPor: 'empleado' | 'coordinador' | 'cron'
    estadoFinal: EstadoJornada
    horaSalidaManual?: Date
}

async function liquidarJornada(
    db: any,
    args: LiquidarArgs,
): Promise<Jornada> {
    const limiteMinutos = args.limiteHoras * 60
    const minutosEfectivos = args.snapshot.minutos_total
    const excedente = Math.max(0, minutosEfectivos - limiteMinutos)
    const alertaCritica = minutosEfectivos > 12 * 60

    // 1. Actualizar la jornada con el snapshot
    const ahora = new Date().toISOString()
    const horaSalidaManual = args.horaSalidaManual?.toISOString() ?? null

    await db
        .prepare(
            `UPDATE jornadas SET
                minutos_normales = ?, minutos_nocturnas = ?, minutos_domingos = ?,
                minutos_festivos = ?, minutos_domingos_festivos_nocturnos = ?,
                minutos_extras_ordinarias = ?, minutos_extras_nocturnas = ?,
                minutos_extras_dominical_festivo = ?, minutos_extras_nocturna_dominical_festivo = ?,
                minutos_total = ?, minutos_almuerzo_descontados = ?,
                estado = ?, salida = ?, cerrada_por = ?, alerta_critica = ?,
                hora_salida_manual = ?, updated_at = ?
             WHERE id = ?`,
        )
        .bind(
            args.snapshot.minutos_normales,
            args.snapshot.minutos_nocturnas,
            args.snapshot.minutos_domingos,
            args.snapshot.minutos_festivos,
            args.snapshot.minutos_domingos_festivos_nocturnos,
            args.snapshot.minutos_extras_ordinarias,
            args.snapshot.minutos_extras_nocturnas,
            args.snapshot.minutos_extras_dominical_festivo,
            args.snapshot.minutos_extras_nocturna_dominical_festivo,
            args.snapshot.minutos_total,
            args.snapshot.minutos_almuerzo_descontados,
            args.estadoFinal,
            args.salida.toISOString(),
            args.cerradaPor,
            alertaCritica ? 1 : 0,
            horaSalidaManual,
            ahora,
            args.jornada.id,
        )
        .run()

    const jornadaActualizada: Jornada = {
        id: args.jornada.id,
        empleado_id: args.jornada.empleado_id,
        operacion: args.jornada.operacion,
        entrada: args.jornada.entrada,
        salida: args.salida.toISOString(),
        estado: args.estadoFinal,
        minutos_normales: args.snapshot.minutos_normales,
        minutos_nocturnas: args.snapshot.minutos_nocturnas,
        minutos_domingos: args.snapshot.minutos_domingos,
        minutos_festivos: args.snapshot.minutos_festivos,
        minutos_domingos_festivos_nocturnos: args.snapshot.minutos_domingos_festivos_nocturnos,
        minutos_extras_ordinarias: args.snapshot.minutos_extras_ordinarias,
        minutos_extras_nocturnas: args.snapshot.minutos_extras_nocturnas,
        minutos_extras_dominical_festivo: args.snapshot.minutos_extras_dominical_festivo,
        minutos_extras_nocturna_dominical_festivo: args.snapshot.minutos_extras_nocturna_dominical_festivo,
        minutos_total: args.snapshot.minutos_total,
        minutos_almuerzo_descontados: args.snapshot.minutos_almuerzo_descontados,
        cerrada_por: args.cerradaPor,
        hora_salida_manual: horaSalidaManual,
        alerta_critica: alertaCritica,
        created_at: args.jornada.created_at,
        updated_at: ahora,
    }

    // 2. Alerta crítica si >12h
    if (alertaCritica) {
        await db
            .prepare(
                `INSERT INTO alertas (id, tipo, empleado_id, jornada_id, operacion, mensaje)
                 VALUES (?, 'ALERTA_CRITICA', ?, ?, ?, ?)`,
            )
            .bind(
                generateId(),
                args.jornada.empleado_id,
                args.jornada.id,
                args.jornada.operacion,
                `La jornada superó 12h (${(minutosEfectivos / 60).toFixed(1)}h efectivas).`,
            )
            .run()
    }

    // 3. Excedente → bolsa primero, resto a aprobación
    if (excedente > 0) {
        const saldoAntes = await obtenerSaldoBolsa(db, args.jornada.empleado_id)
        let extrasPendientes = excedente

        if (saldoAntes < 0) {
            const abono = Math.min(excedente, Math.abs(saldoAntes))
            const saldoDespues = saldoAntes + abono
            extrasPendientes = excedente - abono

            await registrarMovimientoBolsa(db, {
                empleadoId: args.jornada.empleado_id,
                minutos: abono,
                motivo: 'ABONO_EXCEDENTE',
                saldoAntes,
                saldoDespues,
                jornadaId: args.jornada.id,
                nota: 'Excedente de jornada abona deuda en bolsa.',
            })
        }

        if (extrasPendientes > 0) {
            await db
                .prepare(
                    `INSERT INTO aprobaciones_extras (id, jornada_id, empleado_id, minutos_solicitados, estado)
                     VALUES (?, ?, ?, ?, 'PENDIENTE')`,
                )
                .bind(
                    generateId(),
                    args.jornada.id,
                    args.jornada.empleado_id,
                    extrasPendientes,
                )
                .run()

            await db
                .prepare(
                    `INSERT INTO alertas (id, tipo, empleado_id, jornada_id, operacion, mensaje)
                     VALUES (?, 'EXTRAS_PENDIENTES', ?, ?, ?, ?)`,
                )
                .bind(
                    generateId(),
                    args.jornada.empleado_id,
                    args.jornada.id,
                    args.jornada.operacion,
                    `${(extrasPendientes / 60).toFixed(1)}h extra pendientes de aprobación.`,
                )
                .run()
        }
    } else if (minutosEfectivos < limiteMinutos) {
        // 4. Déficit — si no hay novedad remunerada que cubra, descuenta bolsa
        const fechaJornada = fechaColombiaYYYYMMDD(new Date(args.jornada.entrada))
        const cubierta = await hayNovedadRemuneradaParaFecha(
            db,
            args.jornada.empleado_id,
            fechaJornada,
        )

        if (!cubierta) {
            const deficit = limiteMinutos - minutosEfectivos
            const saldoAntes = await obtenerSaldoBolsa(db, args.jornada.empleado_id)
            const saldoDespues = saldoAntes - deficit

            await registrarMovimientoBolsa(db, {
                empleadoId: args.jornada.empleado_id,
                minutos: -deficit,
                motivo: 'CARGO_DEFICIT',
                saldoAntes,
                saldoDespues,
                jornadaId: args.jornada.id,
                nota: `Déficit de ${(deficit / 60).toFixed(1)}h sin novedad remunerada.`,
            })
        }
    }

    return jornadaActualizada
}

// ==================================================
// CONSULTAS DE APOYO
// ==================================================

export async function obtenerJornadaActiva(cedula: string): Promise<Jornada | null> {
    const db = getD1()
    const data = await db
        .prepare("SELECT * FROM jornadas WHERE empleado_id = ? AND estado = 'ABIERTO'")
        .bind(cedula)
        .first() as Jornada | null
    return data ?? null
}

export async function obtenerBolsaHoras(cedula: string): Promise<number> {
    const db = getD1()
    const data = await db
        .prepare('SELECT saldo_minutos FROM bolsa_horas WHERE empleado_id = ?')
        .bind(cedula)
        .first() as { saldo_minutos: number } | null
    return data?.saldo_minutos ?? 0
}

export async function tieneJornadasInconsistentes(cedula: string): Promise<boolean> {
    const db = getD1()
    const row = await db
        .prepare("SELECT COUNT(*) as count FROM jornadas WHERE empleado_id = ? AND estado = 'INCONSISTENTE'")
        .bind(cedula)
        .first<{ count: number }>()
    return (row?.count ?? 0) > 0
}

export async function obtenerJornadasInconsistentes(operacion?: string): Promise<Jornada[]> {
    const db = getD1()

    if (operacion) {
        const { results } = await db
            .prepare("SELECT * FROM jornadas WHERE estado = 'INCONSISTENTE' AND operacion = ? ORDER BY entrada DESC")
            .bind(operacion)
            .all()
        return (results ?? []) as Jornada[]
    }

    const { results } = await db
        .prepare("SELECT * FROM jornadas WHERE estado = 'INCONSISTENTE' ORDER BY entrada DESC")
        .all()
    return (results ?? []) as Jornada[]
}

// ==================================================
// BOLSA POR NOVEDAD COMPENSA_TIEMPO
// ==================================================

/**
 * Descuenta minutos de la bolsa por una novedad COMPENSA_TIEMPO que el
 * coordinador registró. Usado desde el action de crear novedad.
 */
export async function registrarCompensaTiempo(args: {
    empleadoId: string
    minutos: number
    novedadId: string
    nota?: string
}): Promise<Resultado<{ saldo_minutos: number }>> {
    if (args.minutos <= 0) {
        return { data: null, error: 'Los minutos a compensar deben ser positivos.' }
    }
    const db = getD1()
    const saldoAntes = await obtenerSaldoBolsa(db, args.empleadoId)
    const saldoDespues = saldoAntes - args.minutos

    await registrarMovimientoBolsa(db, {
        empleadoId: args.empleadoId,
        minutos: -args.minutos,
        motivo: 'NOVEDAD_COMPENSA',
        saldoAntes,
        saldoDespues,
        novedadId: args.novedadId,
        nota: args.nota ?? 'Compensación de tiempo registrada por coordinador.',
    })

    return { data: { saldo_minutos: saldoDespues }, error: null }
}

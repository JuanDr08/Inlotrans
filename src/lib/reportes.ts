import { getD1 } from '@/lib/d1/client'
import {
    calcularValorPorMinutos,
    horasAFormato,
    minutosAHoras,
    obtenerTarifas,
} from '@/lib/calculoHoras'

// ==================================================
// REPORTES AGREGADOS DESDE `jornadas`
// ==================================================
// El snapshot de cada jornada ya tiene los 9 tipos de minutos calculados
// al momento de cerrarla. Estas funciones agregan por empleado sin recalcular.
// ==================================================

export interface DetalleMinutos {
    normales: number
    nocturnas: number
    domingos: number
    festivos: number
    domingosFestivosNocturnos: number
    extrasOrdinarias: number
    extrasNocturnas: number
    extrasDominicalFestivo: number
    extrasNocturnaDominicalFestivo: number
}

export interface ResumenEmpleadoPeriodo {
    cedula: string
    nombre: string
    operacion: string
    periodo: { inicio: string; fin: string }
    totalMinutos: number
    horasTotales: number
    horasTotalesFormato: string
    detalleMinutos: DetalleMinutos
    horasFormato: Record<keyof DetalleMinutos, string>
    detalleValores: Record<string, number>
    valorTotal: number
}

/** Fila agregada por SQL (SUM de todas las jornadas de un empleado en el período). */
type JornadaAgregado = {
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
}

/** Fila agregada por SQL con GROUP BY empleado_id — incluye identidad del empleado. */
type JornadaAgregadoPorEmpleado = JornadaAgregado & {
    empleado_id: string
    operacion: string
    usuario_nombre?: string
}

function acumuladorVacio(): DetalleMinutos {
    return {
        normales: 0,
        nocturnas: 0,
        domingos: 0,
        festivos: 0,
        domingosFestivosNocturnos: 0,
        extrasOrdinarias: 0,
        extrasNocturnas: 0,
        extrasDominicalFestivo: 0,
        extrasNocturnaDominicalFestivo: 0,
    }
}

function mapAgregadoADetalle(a: JornadaAgregado): DetalleMinutos {
    return {
        normales:                       a.minutos_normales,
        nocturnas:                      a.minutos_nocturnas,
        domingos:                       a.minutos_domingos,
        festivos:                       a.minutos_festivos,
        domingosFestivosNocturnos:      a.minutos_domingos_festivos_nocturnos,
        extrasOrdinarias:               a.minutos_extras_ordinarias,
        extrasNocturnas:                a.minutos_extras_nocturnas,
        extrasDominicalFestivo:         a.minutos_extras_dominical_festivo,
        extrasNocturnaDominicalFestivo: a.minutos_extras_nocturna_dominical_festivo,
    }
}

function calcularValores(detalle: DetalleMinutos, tarifas: Record<string, number>) {
    const valores = {
        normal:                          calcularValorPorMinutos(detalle.normales, tarifas.normal),
        nocturnas:                       calcularValorPorMinutos(detalle.nocturnas, tarifas.nocturno),
        extrasOrdinarias:                calcularValorPorMinutos(detalle.extrasOrdinarias, tarifas.extra),
        extrasNocturnas:                 calcularValorPorMinutos(detalle.extrasNocturnas, tarifas.extraNocturno),
        domingos:                        calcularValorPorMinutos(detalle.domingos, tarifas.domingo),
        festivos:                        calcularValorPorMinutos(detalle.festivos, tarifas.festivo),
        domingosFestivosNocturnos:       calcularValorPorMinutos(detalle.domingosFestivosNocturnos, tarifas.domingoFestivoNocturno),
        extrasDominicalFestivo:          calcularValorPorMinutos(detalle.extrasDominicalFestivo, tarifas.extraDominicalFestivo),
        extrasNocturnaDominicalFestivo:  calcularValorPorMinutos(detalle.extrasNocturnaDominicalFestivo, tarifas.extraNocturnaDominicalFestivo),
    }
    const total = Object.values(valores).reduce((a, b) => a + b, 0)
    return { valores, total: Math.round(total * 100) / 100 }
}

function toFormatoHoras(detalle: DetalleMinutos): Record<keyof DetalleMinutos, string> {
    return {
        normales:                       horasAFormato(minutosAHoras(detalle.normales)),
        nocturnas:                      horasAFormato(minutosAHoras(detalle.nocturnas)),
        domingos:                       horasAFormato(minutosAHoras(detalle.domingos)),
        festivos:                       horasAFormato(minutosAHoras(detalle.festivos)),
        domingosFestivosNocturnos:      horasAFormato(minutosAHoras(detalle.domingosFestivosNocturnos)),
        extrasOrdinarias:               horasAFormato(minutosAHoras(detalle.extrasOrdinarias)),
        extrasNocturnas:                horasAFormato(minutosAHoras(detalle.extrasNocturnas)),
        extrasDominicalFestivo:         horasAFormato(minutosAHoras(detalle.extrasDominicalFestivo)),
        extrasNocturnaDominicalFestivo: horasAFormato(minutosAHoras(detalle.extrasNocturnaDominicalFestivo)),
    }
}

function totalMinutos(d: DetalleMinutos): number {
    return (
        d.normales + d.nocturnas + d.domingos + d.festivos + d.domingosFestivosNocturnos +
        d.extrasOrdinarias + d.extrasNocturnas + d.extrasDominicalFestivo + d.extrasNocturnaDominicalFestivo
    )
}

/**
 * Resumen por empleado de un período — agrega sus jornadas CERRADO y CERRADO_MANUAL.
 */
export async function calcularHorasUsuarioEnPeriodo(
    cedula: string,
    fechaInicio: Date,
    fechaFin: Date,
): Promise<ResumenEmpleadoPeriodo | null> {
    const db = getD1()

    const [usuario, agregado] = await Promise.all([
        db.prepare('SELECT id, nombre, operacion FROM usuarios WHERE id = ?')
            .bind(cedula)
            .first<{ id: string; nombre: string; operacion: string | null }>(),
        db.prepare(
            `SELECT
                    COALESCE(SUM(minutos_normales), 0) as minutos_normales,
                    COALESCE(SUM(minutos_nocturnas), 0) as minutos_nocturnas,
                    COALESCE(SUM(minutos_domingos), 0) as minutos_domingos,
                    COALESCE(SUM(minutos_festivos), 0) as minutos_festivos,
                    COALESCE(SUM(minutos_domingos_festivos_nocturnos), 0) as minutos_domingos_festivos_nocturnos,
                    COALESCE(SUM(minutos_extras_ordinarias), 0) as minutos_extras_ordinarias,
                    COALESCE(SUM(minutos_extras_nocturnas), 0) as minutos_extras_nocturnas,
                    COALESCE(SUM(minutos_extras_dominical_festivo), 0) as minutos_extras_dominical_festivo,
                    COALESCE(SUM(minutos_extras_nocturna_dominical_festivo), 0) as minutos_extras_nocturna_dominical_festivo,
                    COALESCE(SUM(minutos_total), 0) as minutos_total
             FROM jornadas
             WHERE empleado_id = ?
               AND estado IN ('CERRADO', 'CERRADO_MANUAL')
               AND entrada >= ?
               AND entrada <= ?`,
        )
            .bind(cedula, fechaInicio.toISOString(), fechaFin.toISOString())
            .first<JornadaAgregado>(),
    ])

    if (!usuario) return null

    const detalle = agregado ? mapAgregadoADetalle(agregado) : acumuladorVacio()
    const total = totalMinutos(detalle)
    const tarifas = await obtenerTarifas()
    const { valores, total: valorTotal } = calcularValores(detalle, tarifas)

    return {
        cedula: usuario.id,
        nombre: usuario.nombre,
        operacion: usuario.operacion ?? '',
        periodo: { inicio: fechaInicio.toISOString(), fin: fechaFin.toISOString() },
        totalMinutos: total,
        horasTotales: minutosAHoras(total),
        horasTotalesFormato: horasAFormato(minutosAHoras(total)),
        detalleMinutos: detalle,
        horasFormato: toFormatoHoras(detalle),
        detalleValores: valores,
        valorTotal,
    }
}

/**
 * Resumen agregado de todos los empleados con jornadas cerradas en el período.
 * Filtra por array de operaciones si se provee.
 * Acepta `limit`/`offset` opcionales para paginación — cuando se proveen,
 * también retorna el total de empleados distintos que matchean el filtro.
 */
export async function calcularHorasTodosEnPeriodo(
    fechaInicio: Date,
    fechaFin: Date,
    operaciones: string[] = [],
    limit?: number,
    offset?: number,
): Promise<{ data: ResumenEmpleadoPeriodo[]; total: number }> {
    const db = getD1()

    // Build query with optional operaciones filter — aggregation happens in SQL
    let sql = `
        SELECT j.empleado_id, j.operacion, u.nombre AS usuario_nombre,
               SUM(j.minutos_normales) as minutos_normales,
               SUM(j.minutos_nocturnas) as minutos_nocturnas,
               SUM(j.minutos_domingos) as minutos_domingos,
               SUM(j.minutos_festivos) as minutos_festivos,
               SUM(j.minutos_domingos_festivos_nocturnos) as minutos_domingos_festivos_nocturnos,
               SUM(j.minutos_extras_ordinarias) as minutos_extras_ordinarias,
               SUM(j.minutos_extras_nocturnas) as minutos_extras_nocturnas,
               SUM(j.minutos_extras_dominical_festivo) as minutos_extras_dominical_festivo,
               SUM(j.minutos_extras_nocturna_dominical_festivo) as minutos_extras_nocturna_dominical_festivo,
               SUM(j.minutos_total) as minutos_total
        FROM jornadas j
        INNER JOIN usuarios u ON u.id = j.empleado_id
        WHERE j.estado IN ('CERRADO', 'CERRADO_MANUAL')
          AND j.entrada >= ?
          AND j.entrada <= ?`

    let countSql = `
        SELECT COUNT(DISTINCT j.empleado_id) as total
        FROM jornadas j
        WHERE j.estado IN ('CERRADO', 'CERRADO_MANUAL')
          AND j.entrada >= ?
          AND j.entrada <= ?`

    const params: unknown[] = [fechaInicio.toISOString(), fechaFin.toISOString()]
    const countParams: unknown[] = [fechaInicio.toISOString(), fechaFin.toISOString()]

    if (operaciones.length > 0) {
        const placeholders = operaciones.map(() => '?').join(', ')
        sql += ` AND j.operacion IN (${placeholders})`
        countSql += ` AND j.operacion IN (${placeholders})`
        params.push(...operaciones)
        countParams.push(...operaciones)
    }

    sql += ` GROUP BY j.empleado_id, j.operacion, u.nombre`
    sql += ` ORDER BY u.nombre ASC`

    if (limit !== undefined) {
        sql += ` LIMIT ? OFFSET ?`
        params.push(limit, offset ?? 0)
    }

    const [{ results }, countRow] = await Promise.all([
        db.prepare(sql).bind(...params).all(),
        db.prepare(countSql).bind(...countParams).first<{ total: number }>(),
    ])

    const total = countRow?.total ?? 0

    if (!results || results.length === 0) return { data: [], total }

    const tarifas = await obtenerTarifas()
    const resultados: ResumenEmpleadoPeriodo[] = []

    for (const row of results) {
        const r = row as JornadaAgregadoPorEmpleado
        const detalle = mapAgregadoADetalle(r)
        const total = totalMinutos(detalle)
        const { valores, total: valorTotal } = calcularValores(detalle, tarifas)
        resultados.push({
            cedula: r.empleado_id,
            nombre: r.usuario_nombre ?? '',
            operacion: r.operacion,
            periodo: { inicio: fechaInicio.toISOString(), fin: fechaFin.toISOString() },
            totalMinutos: total,
            horasTotales: minutosAHoras(total),
            horasTotalesFormato: horasAFormato(minutosAHoras(total)),
            detalleMinutos: detalle,
            horasFormato: toFormatoHoras(detalle),
            detalleValores: valores,
            valorTotal,
        })
    }

    return { data: resultados, total }
}

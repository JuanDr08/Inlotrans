'use server'

import { getD1 } from '@/lib/d1/client'

export async function getEmpleadoDetalle(cedula: string) {
    try {
        const db = getD1()
        const empleado = await db.prepare(
            'SELECT * FROM usuarios WHERE id = ?'
        ).bind(cedula).first()

        return empleado ?? null
    } catch (err) {
        console.error('[getEmpleadoDetalle]', err)
        return null
    }
}

export async function getJornadasRango(
    cedula: string,
    fechaInicio: string,
    fechaFin: string,
) {
    try {
        const db = getD1()
        const { results } = await db.prepare(
            `SELECT id, empleado_id, operacion, entrada, salida, estado, minutos_total,
                    minutos_normales, minutos_nocturnas, minutos_domingos, minutos_festivos,
                    minutos_domingos_festivos_nocturnos, minutos_extras_ordinarias,
                    minutos_extras_nocturnas, minutos_extras_dominical_festivo,
                    minutos_extras_nocturna_dominical_festivo, minutos_almuerzo_descontados,
                    cerrada_por, alerta_critica
             FROM jornadas
             WHERE empleado_id = ? AND entrada >= ? AND entrada <= ?
             ORDER BY entrada DESC`
        ).bind(cedula, fechaInicio, fechaFin).all()

        return results ?? []
    } catch (err) {
        console.error('[getJornadasRango]', err)
        return []
    }
}

export async function getNovedadesEmpleado(cedula: string, limite = 20) {
    try {
        const db = getD1()
        const { results } = await db.prepare(
            `SELECT id, tipo_novedad, fecha_novedad, fecha_inicio, fecha_fin, es_pagado,
                    codigo_causa, valor_monetario, descripcion, created_at
             FROM novedades
             WHERE usuario_id = ?
             ORDER BY fecha_novedad DESC
             LIMIT ?`
        ).bind(cedula, limite).all()

        return results ?? []
    } catch (err) {
        return []
    }
}

export async function getMovimientosBolsa(cedula: string, limite = 15) {
    try {
        const db = getD1()
        const { results } = await db.prepare(
            `SELECT id, minutos, motivo, saldo_antes, saldo_despues, nota, created_at,
                    jornada_id, novedad_id
             FROM movimientos_bolsa
             WHERE empleado_id = ?
             ORDER BY created_at DESC
             LIMIT ?`
        ).bind(cedula, limite).all()

        return results ?? []
    } catch (err) {
        return []
    }
}

export async function getAprobacionesEmpleado(cedula: string, limite = 10) {
    try {
        const db = getD1()
        const { results } = await db.prepare(
            `SELECT id, jornada_id, minutos_solicitados, estado, coordinador_id,
                    nota_coordinador, created_at, updated_at
             FROM aprobaciones_extras
             WHERE empleado_id = ?
             ORDER BY created_at DESC
             LIMIT ?`
        ).bind(cedula, limite).all()

        return results ?? []
    } catch (err) {
        return []
    }
}

export async function getAlertasEmpleado(cedula: string) {
    try {
        const db = getD1()
        const { results } = await db.prepare(
            `SELECT id, tipo, jornada_id, operacion, mensaje, leida, created_at
             FROM alertas
             WHERE empleado_id = ? AND leida = 0
             ORDER BY created_at DESC`
        ).bind(cedula).all()

        return results ?? []
    } catch (err) {
        return []
    }
}

export async function getSemanaDominicalActual(cedula: string) {
    try {
        const db = getD1()
        const data = await db.prepare(
            `SELECT semana_inicio, semana_fin, minutos_ordinarios, minutos_novedades_remuneradas,
                    total_minutos_cumplimiento, paga_domingo, marcado_por, created_at
             FROM semanas_dominicales
             WHERE empleado_id = ?
             ORDER BY semana_inicio DESC
             LIMIT 1`
        ).bind(cedula).first()

        return data ?? null
    } catch (err) {
        return null
    }
}

export async function getTurnoOperacion(operacion: string | null) {
    if (!operacion) return null

    try {
        const db = getD1()

        const op = await db.prepare(
            'SELECT id, limite_horas, minutos_almuerzo FROM operaciones WHERE nombre = ?'
        ).bind(operacion).first<{ id: string; limite_horas: number; minutos_almuerzo: number }>()

        if (!op) return null

        const { results: turnos } = await db.prepare(
            'SELECT nombre, hora_inicio, hora_fin FROM turnos WHERE operacion_id = ? ORDER BY hora_inicio ASC'
        ).bind(op.id).all()

        return {
            limite_horas: op.limite_horas,
            minutos_almuerzo: op.minutos_almuerzo,
            turnos: turnos ?? [],
        }
    } catch (err) {
        return null
    }
}

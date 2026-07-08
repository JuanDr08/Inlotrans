'use server'

import { getD1 } from '@/lib/d1/client'
import { getUserProfile } from '@/lib/auth'
import { requireAdminOrCoordinador, getOperationFilter } from '@/lib/auth-helpers'
import { revalidatePath } from 'next/cache'

export async function getAprobacionesPendientes(limit?: number, offset?: number) {
    const db = getD1()
    const profile = await getUserProfile()
    requireAdminOrCoordinador(profile)
    const filtroOp = getOperationFilter(profile)

    try {
        let baseSql = `FROM aprobaciones_extras a
             LEFT JOIN jornadas j ON j.id = a.jornada_id
             LEFT JOIN usuarios u ON u.id = a.empleado_id
             WHERE a.estado = 'PENDIENTE'`
        const binds: unknown[] = []

        if (filtroOp.length > 0) {
            const placeholders = filtroOp.map(() => '?').join(', ')
            baseSql += ` AND j.operacion IN (${placeholders})`
            binds.push(...filtroOp)
        }

        const countRow = await db.prepare(
            `SELECT COUNT(*) as total ${baseSql}`
        ).bind(...binds).first<{ total: number }>()
        const total = countRow?.total ?? 0

        let dataSql = `SELECT a.id, a.minutos_solicitados, a.estado, a.created_at, a.empleado_id, a.jornada_id,
                    j.entrada as jornada_entrada, j.salida as jornada_salida,
                    j.operacion as jornada_operacion, j.minutos_total as jornada_minutos_total,
                    u.nombre as usuario_nombre, u.operacion as usuario_operacion
             ${baseSql} ORDER BY a.created_at DESC`
        const dataBinds = [...binds]

        if (limit != null) {
            dataSql += ' LIMIT ?'
            dataBinds.push(limit)
            if (offset != null) {
                dataSql += ' OFFSET ?'
                dataBinds.push(offset)
            }
        }

        const { results } = await db.prepare(dataSql).bind(...dataBinds).all()

        const shaped = (results ?? []).map((r: any) => ({
            id: r.id,
            minutos_solicitados: r.minutos_solicitados,
            estado: r.estado,
            created_at: r.created_at,
            empleado_id: r.empleado_id,
            jornada_id: r.jornada_id,
            jornadas: {
                entrada: r.jornada_entrada,
                salida: r.jornada_salida,
                operacion: r.jornada_operacion,
                minutos_total: r.jornada_minutos_total,
            },
            usuarios: {
                nombre: r.usuario_nombre,
                operacion: r.usuario_operacion,
            },
        }))

        return { success: true, data: shaped, total }
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error interno'
        return { success: false, error: msg, data: [], total: 0 }
    }
}

export async function aprobarExtras(aprobacionId: string, nota?: string) {
    const db = getD1()
    const profile = await getUserProfile()
    requireAdminOrCoordinador(profile)

    try {
        await db.prepare(
            `UPDATE aprobaciones_extras
             SET estado = 'APROBADA', coordinador_id = ?, nota_coordinador = ?, updated_at = ?
             WHERE id = ?`
        ).bind(
            profile.userId,
            nota ?? null,
            new Date().toISOString(),
            aprobacionId
        ).run()
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error interno'
        return { success: false, error: msg }
    }

    revalidatePath('/aprobaciones')
    return { success: true }
}

export async function rechazarExtras(aprobacionId: string, nota: string) {
    const db = getD1()
    const profile = await getUserProfile()
    requireAdminOrCoordinador(profile)

    try {
        await db.prepare(
            `UPDATE aprobaciones_extras
             SET estado = 'RECHAZADA', coordinador_id = ?, nota_coordinador = ?, updated_at = ?
             WHERE id = ?`
        ).bind(
            profile.userId,
            nota,
            new Date().toISOString(),
            aprobacionId
        ).run()
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error interno'
        return { success: false, error: msg }
    }

    revalidatePath('/aprobaciones')
    return { success: true }
}

export async function getJornadasInconsistentes(limit?: number, offset?: number) {
    const db = getD1()
    const profile = await getUserProfile()
    requireAdminOrCoordinador(profile)
    const filtroOp = getOperationFilter(profile)

    try {
        let baseSql = `FROM jornadas j
                     LEFT JOIN usuarios u ON u.id = j.empleado_id
                     WHERE j.estado = 'INCONSISTENTE'`
        const binds: unknown[] = []

        if (filtroOp.length > 0) {
            const placeholders = filtroOp.map(() => '?').join(', ')
            baseSql += ` AND j.operacion IN (${placeholders})`
            binds.push(...filtroOp)
        }

        const countRow = await db.prepare(
            `SELECT COUNT(*) as total ${baseSql}`
        ).bind(...binds).first<{ total: number }>()
        const total = countRow?.total ?? 0

        let dataSql = `SELECT j.id, j.empleado_id, j.operacion, j.entrada, j.estado, j.created_at,
                            u.nombre as usuario_nombre
                     ${baseSql} ORDER BY j.entrada DESC`
        const dataBinds = [...binds]

        if (limit != null) {
            dataSql += ' LIMIT ?'
            dataBinds.push(limit)
            if (offset != null) {
                dataSql += ' OFFSET ?'
                dataBinds.push(offset)
            }
        }

        const { results } = dataBinds.length > 0
            ? await db.prepare(dataSql).bind(...dataBinds).all()
            : await db.prepare(dataSql).all()

        const shaped = (results ?? []).map((r: any) => ({
            id: r.id,
            empleado_id: r.empleado_id,
            operacion: r.operacion,
            entrada: r.entrada,
            estado: r.estado,
            created_at: r.created_at,
            usuarios: {
                nombre: r.usuario_nombre,
            },
        }))

        return { success: true, data: shaped, total }
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error interno'
        return { success: false, error: msg, data: [], total: 0 }
    }
}

export async function getAprobacionesResueltas(limit?: number, offset?: number) {
    const db = getD1()
    const profile = await getUserProfile()
    requireAdminOrCoordinador(profile)
    const filtroOp = getOperationFilter(profile)

    try {
        let baseSql = `FROM aprobaciones_extras a
             LEFT JOIN jornadas j ON j.id = a.jornada_id
             LEFT JOIN usuarios u ON u.id = a.empleado_id
             WHERE a.estado IN ('APROBADA', 'RECHAZADA')`
        const binds: unknown[] = []

        if (filtroOp.length > 0) {
            const placeholders = filtroOp.map(() => '?').join(', ')
            baseSql += ` AND j.operacion IN (${placeholders})`
            binds.push(...filtroOp)
        }

        const countRow = await db.prepare(
            `SELECT COUNT(*) as total ${baseSql}`
        ).bind(...binds).first<{ total: number }>()
        const total = countRow?.total ?? 0

        let dataSql = `SELECT a.id, a.minutos_solicitados, a.estado, a.created_at, a.updated_at,
                    a.empleado_id, a.jornada_id, a.coordinador_id, a.nota_coordinador,
                    j.entrada as jornada_entrada, j.salida as jornada_salida,
                    j.operacion as jornada_operacion, j.minutos_total as jornada_minutos_total,
                    u.nombre as usuario_nombre, u.operacion as usuario_operacion
             ${baseSql} ORDER BY a.updated_at DESC`
        const dataBinds = [...binds]

        if (limit != null) {
            dataSql += ' LIMIT ?'
            dataBinds.push(limit)
            if (offset != null) {
                dataSql += ' OFFSET ?'
                dataBinds.push(offset)
            }
        }

        const { results } = await db.prepare(dataSql).bind(...dataBinds).all()

        const shaped = (results ?? []).map((r: any) => ({
            id: r.id,
            minutos_solicitados: r.minutos_solicitados,
            estado: r.estado,
            created_at: r.created_at,
            updated_at: r.updated_at,
            empleado_id: r.empleado_id,
            jornada_id: r.jornada_id,
            coordinador_id: r.coordinador_id,
            nota_coordinador: r.nota_coordinador,
            jornadas: {
                entrada: r.jornada_entrada,
                salida: r.jornada_salida,
                operacion: r.jornada_operacion,
                minutos_total: r.jornada_minutos_total,
            },
            usuarios: {
                nombre: r.usuario_nombre,
                operacion: r.usuario_operacion,
            },
        }))

        return { success: true, data: shaped, total }
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error interno'
        return { success: false, error: msg, data: [], total: 0 }
    }
}

export async function revertirAprobacion(aprobacionId: string, nota: string) {
    const db = getD1()
    const profile = await getUserProfile()
    requireAdminOrCoordinador(profile)

    try {
        const existing = await db.prepare(
            `SELECT estado FROM aprobaciones_extras WHERE id = ?`
        ).bind(aprobacionId).first<{ estado: string }>()

        if (!existing) {
            return { success: false, error: 'Aprobación no encontrada.' }
        }
        if (existing.estado === 'PENDIENTE') {
            return { success: false, error: 'Esta aprobación ya está en estado PENDIENTE.' }
        }

        await db.prepare(
            `UPDATE aprobaciones_extras
             SET estado = 'PENDIENTE', coordinador_id = NULL, nota_coordinador = ?, updated_at = ?
             WHERE id = ?`
        ).bind(
            nota,
            new Date().toISOString(),
            aprobacionId
        ).run()
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error interno'
        return { success: false, error: msg }
    }

    revalidatePath('/aprobaciones')
    return { success: true }
}

export async function corregirInconsistente(jornadaId: string, horaSalidaISO: string) {
    const db = getD1()
    const profile = await getUserProfile()
    requireAdminOrCoordinador(profile)

    const { corregirJornadaInconsistente } = await import('@/lib/jornadas')
    const { data, error } = await corregirJornadaInconsistente(jornadaId, new Date(horaSalidaISO))
    if (error || !data) return { success: false, error: error ?? 'Error al corregir jornada' }

    try {
        await db.prepare(
            `UPDATE alertas SET leida = 1 WHERE jornada_id = ? AND tipo = 'INCONSISTENTE'`
        ).bind(jornadaId).run()
    } catch {
        // Best-effort update
    }

    revalidatePath('/aprobaciones')
    return { success: true }
}

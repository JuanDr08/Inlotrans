'use server'

import { getD1 } from '@/lib/d1/client'
import { getUserProfile } from '@/lib/auth'
import { requireAdminOrCoordinador, getOperationFilter } from '@/lib/auth-helpers'
import { revalidatePath } from 'next/cache'

export async function getAprobacionesPendientes() {
    const db = getD1()
    const profile = await getUserProfile()
    requireAdminOrCoordinador(profile)
    const filtroOp = getOperationFilter(profile)

    try {
        const { results } = await db.prepare(
            `SELECT a.id, a.minutos_solicitados, a.estado, a.created_at, a.empleado_id, a.jornada_id,
                    j.entrada as jornada_entrada, j.salida as jornada_salida,
                    j.operacion as jornada_operacion, j.minutos_total as jornada_minutos_total,
                    u.nombre as usuario_nombre, u.operacion as usuario_operacion
             FROM aprobaciones_extras a
             LEFT JOIN jornadas j ON j.id = a.jornada_id
             LEFT JOIN usuarios u ON u.id = a.empleado_id
             WHERE a.estado = 'PENDIENTE'
             ORDER BY a.created_at DESC`
        ).all()

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

        const resultado = filtroOp.length > 0
            ? shaped.filter((ap: any) => filtroOp.includes(ap.jornadas?.operacion))
            : shaped

        return { success: true, data: resultado }
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error interno'
        return { success: false, error: msg, data: [] }
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

export async function getJornadasInconsistentes() {
    const db = getD1()
    const profile = await getUserProfile()
    requireAdminOrCoordinador(profile)
    const filtroOp = getOperationFilter(profile)

    try {
        let query: string
        let bindings: any[]

        if (filtroOp.length > 0) {
            const placeholders = filtroOp.map(() => '?').join(', ')
            query = `SELECT j.id, j.empleado_id, j.operacion, j.entrada, j.estado, j.created_at,
                            u.nombre as usuario_nombre
                     FROM jornadas j
                     LEFT JOIN usuarios u ON u.id = j.empleado_id
                     WHERE j.estado = 'INCONSISTENTE' AND j.operacion IN (${placeholders})
                     ORDER BY j.entrada DESC`
            bindings = [...filtroOp]
        } else {
            query = `SELECT j.id, j.empleado_id, j.operacion, j.entrada, j.estado, j.created_at,
                            u.nombre as usuario_nombre
                     FROM jornadas j
                     LEFT JOIN usuarios u ON u.id = j.empleado_id
                     WHERE j.estado = 'INCONSISTENTE'
                     ORDER BY j.entrada DESC`
            bindings = []
        }

        const stmt = db.prepare(query)
        const { results } = bindings.length > 0
            ? await stmt.bind(...bindings).all()
            : await stmt.all()

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

        return { success: true, data: shaped }
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error interno'
        return { success: false, error: msg, data: [] }
    }
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

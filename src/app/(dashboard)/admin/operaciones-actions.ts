'use server'

import { getD1, generateId } from '@/lib/d1/client'
import { unstable_cache } from 'next/cache'
import { getUserProfile } from '@/lib/auth'
import { requireAdmin } from '@/lib/auth-helpers'

export type Operacion = {
    id: string
    codigo: string
    nombre: string
    status: boolean
    limite_horas: 8 | 12
    max_extras_dia: number
    minutos_almuerzo: number
    created_at?: string
}

export type Turno = {
    id: string
    operacion_id: string
    nombre: string
    hora_inicio: string
    hora_fin: string
    created_at?: string
}

export async function getOperacionesAdmin() {
    requireAdmin(await getUserProfile())

    try {
        const db = getD1()
        const { results } = await db.prepare(
            'SELECT * FROM operaciones ORDER BY created_at ASC'
        ).all()

        const data = (results ?? []).map((r: any) => ({
            ...r,
            status: !!r.status,
        })) as Operacion[]

        return { success: true, data }
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error interno'
        console.error('Error fetching operaciones (Admin):', err)
        return { success: false, error: msg }
    }
}

export const getOperacionesActivas = unstable_cache(
    async () => {
        try {
            const db = getD1()
            const { results } = await db.prepare(
                'SELECT id, nombre FROM operaciones WHERE status = 1 ORDER BY nombre ASC'
            ).all()
            return { success: true, data: (results ?? []) as Pick<Operacion, 'id' | 'nombre'>[] }
        } catch (err) {
            console.error('Error fetching operaciones (Kiosco cacheado):', err)
            return { success: false, data: [] }
        }
    },
    ['operaciones-activas'],
    { revalidate: 300, tags: ['operaciones'] }
)

export async function upsertOperacion(operacion: Partial<Operacion>) {
    requireAdmin(await getUserProfile())
    const db = getD1()

    try {
        if (operacion.id) {
            await db.prepare(
                `UPDATE operaciones SET codigo = ?, nombre = ?, status = ?, limite_horas = ?,
                    max_extras_dia = ?, minutos_almuerzo = ?
                 WHERE id = ?`
            ).bind(
                operacion.codigo,
                operacion.nombre,
                operacion.status ? 1 : 0,
                operacion.limite_horas ?? 8,
                operacion.max_extras_dia ?? 2,
                operacion.minutos_almuerzo ?? 0,
                operacion.id
            ).run()
        } else {
            if (!operacion.codigo?.trim()) return { success: false, error: 'El código de operación es obligatorio.' }

            const existente = await db.prepare(
                'SELECT id FROM operaciones WHERE nombre = ?'
            ).bind(operacion.nombre).first()
            if (existente) return { success: false, error: 'Ya existe una operación con ese nombre.' }

            const codigoExistente = await db.prepare(
                'SELECT id FROM operaciones WHERE codigo = ?'
            ).bind(operacion.codigo).first()
            if (codigoExistente) return { success: false, error: 'Ya existe una operación con ese código.' }

            const id = generateId()
            await db.prepare(
                `INSERT INTO operaciones (id, codigo, nombre, status, limite_horas, max_extras_dia, minutos_almuerzo)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`
            ).bind(
                id,
                operacion.codigo.trim().toUpperCase(),
                operacion.nombre,
                operacion.status !== false ? 1 : 0,
                operacion.limite_horas ?? 8,
                operacion.max_extras_dia ?? 2,
                operacion.minutos_almuerzo ?? 0,
            ).run()
        }
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error interno'
        return { success: false, error: msg }
    }

    const { revalidateTag } = await import('next/cache')
    revalidateTag('operaciones', 'max')

    return { success: true }
}

export async function getTurnosPorOperacion(operacionId: string) {
    requireAdmin(await getUserProfile())

    try {
        const db = getD1()
        const { results } = await db.prepare(
            'SELECT * FROM turnos WHERE operacion_id = ? ORDER BY hora_inicio ASC'
        ).bind(operacionId).all()

        return { success: true, data: (results ?? []) as Turno[] }
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error interno'
        return { success: false, error: msg }
    }
}

export async function getTurnosPorNombreOperacion(nombreOperacion: string) {
    try {
        const db = getD1()

        const op = await db.prepare(
            'SELECT id FROM operaciones WHERE nombre = ?'
        ).bind(nombreOperacion).first<{ id: string }>()

        if (!op) return { success: true, data: [] as Turno[] }

        const { results } = await db.prepare(
            'SELECT * FROM turnos WHERE operacion_id = ? ORDER BY hora_inicio ASC'
        ).bind(op.id).all()

        return { success: true, data: (results ?? []) as Turno[] }
    } catch (err) {
        return { success: false, data: [] as Turno[] }
    }
}

export async function crearTurno(turno: { operacion_id: string; nombre: string; hora_inicio: string; hora_fin: string }) {
    requireAdmin(await getUserProfile())

    if (!turno.nombre?.trim() || !turno.hora_inicio || !turno.hora_fin) {
        return { success: false, error: 'Todos los campos del turno son obligatorios' }
    }

    try {
        const db = getD1()
        const id = generateId()
        await db.prepare(
            'INSERT INTO turnos (id, operacion_id, nombre, hora_inicio, hora_fin) VALUES (?, ?, ?, ?, ?)'
        ).bind(id, turno.operacion_id, turno.nombre, turno.hora_inicio, turno.hora_fin).run()
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error interno'
        return { success: false, error: msg }
    }

    return { success: true }
}

export async function editarTurno(id: string, turno: { nombre: string; hora_inicio: string; hora_fin: string }) {
    requireAdmin(await getUserProfile())

    try {
        const db = getD1()
        await db.prepare(
            'UPDATE turnos SET nombre = ?, hora_inicio = ?, hora_fin = ? WHERE id = ?'
        ).bind(turno.nombre, turno.hora_inicio, turno.hora_fin, id).run()
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error interno'
        return { success: false, error: msg }
    }

    return { success: true }
}

export async function eliminarTurno(id: string) {
    requireAdmin(await getUserProfile())

    try {
        const db = getD1()
        await db.prepare('DELETE FROM turnos WHERE id = ?').bind(id).run()
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error interno'
        return { success: false, error: msg }
    }

    return { success: true }
}

export async function deleteOperacion(id: string) {
    requireAdmin(await getUserProfile())

    try {
        const db = getD1()
        await db.prepare('DELETE FROM operaciones WHERE id = ?').bind(id).run()
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error interno'
        return { success: false, error: msg }
    }

    const { revalidateTag } = await import('next/cache')
    revalidateTag('operaciones', 'max')

    return { success: true }
}

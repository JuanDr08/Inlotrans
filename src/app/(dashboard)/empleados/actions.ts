'use server'

import { getD1 } from '@/lib/d1/client'
import { revalidatePath } from 'next/cache'
import { getUserProfile } from '@/lib/auth'
import { requireAdminOrCoordinador } from '@/lib/auth-helpers'

export async function crearEmpleado(formData: FormData) {
    const profile = await getUserProfile()
    requireAdminOrCoordinador(profile)

    const cedula = formData.get('cedula') as string
    const nombre = formData.get('nombre') as string
    const cargo = formData.get('cargo') as string
    const operacion = formData.get('operacion') as string
    const birthdate = formData.get('birthdate') as string

    if (!cedula || !nombre || !cargo || !operacion) {
        return { success: false, error: 'Todos los campos marcados con * son obligatorios' }
    }

    if (profile.rol === 'coordinador' && operacion !== profile.operacion_nombre) {
        return { success: false, error: 'Solo puedes crear empleados en tu operación' }
    }

    const turno_id = formData.get('turno_id') as string | null
    const salarioStr = formData.get('salario') as string | null

    try {
        const db = getD1()
        await db.prepare(
            `INSERT INTO usuarios (id, nombre, cargo, operacion, birthdate, status, turno_id, salario)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            cedula,
            nombre,
            cargo,
            operacion,
            birthdate ? new Date(birthdate).toISOString() : null,
            'activo',
            turno_id || null,
            salarioStr ? parseFloat(salarioStr) : null
        ).run()
    } catch (err) {
        const msg = err instanceof Error ? err.message : ''
        if (msg.includes('UNIQUE constraint failed')) {
            return { success: false, error: 'Ya existe un empleado registrado con esa cédula' }
        }
        console.error('Error insertando empleado:', err)
        return { success: false, error: 'Error interno al registrar empleado' }
    }

    revalidatePath('/empleados')
    return { success: true }
}

export async function editarEmpleado(formData: FormData) {
    const profile = await getUserProfile()
    requireAdminOrCoordinador(profile)

    const db = getD1()

    const cedula = formData.get('cedula') as string
    const nombre = formData.get('nombre') as string
    const cargo = formData.get('cargo') as string
    const operacion = formData.get('operacion') as string
    const status = formData.get('status') as string

    if (!cedula || !nombre || !cargo || !operacion || !status) {
        return { success: false, error: 'Todos los campos son obligatorios' }
    }

    if (profile.rol === 'coordinador') {
        const empleado = await db.prepare(
            'SELECT operacion FROM usuarios WHERE id = ?'
        ).bind(cedula).first<{ operacion: string }>()

        if (!empleado || empleado.operacion !== profile.operacion_nombre) {
            return { success: false, error: 'Solo puedes editar empleados de tu operación' }
        }
    }

    const turno_id = formData.get('turno_id') as string | null
    const salarioStr = formData.get('salario') as string | null
    const nuevaCedula = formData.get('nueva_cedula') as string | null

    try {
        if (nuevaCedula && nuevaCedula !== cedula) {
            await db.prepare(
                `UPDATE usuarios SET id = ?, nombre = ?, cargo = ?, operacion = ?, status = ?, turno_id = ?, salario = ?
                 WHERE id = ?`
            ).bind(
                nuevaCedula, nombre, cargo, operacion, status,
                turno_id || null,
                salarioStr ? parseFloat(salarioStr) : null,
                cedula
            ).run()
        } else {
            await db.prepare(
                `UPDATE usuarios SET nombre = ?, cargo = ?, operacion = ?, status = ?, turno_id = ?, salario = ?
                 WHERE id = ?`
            ).bind(
                nombre, cargo, operacion, status,
                turno_id || null,
                salarioStr ? parseFloat(salarioStr) : null,
                cedula
            ).run()
        }
    } catch (err) {
        console.error('Error actualizando empleado:', err)
        return { success: false, error: 'Error interno al actualizar empleado' }
    }

    revalidatePath('/empleados')
    return { success: true }
}

export async function cambiarEstadoEmpleado(cedula: string, status: string) {
    const profile = await getUserProfile()
    requireAdminOrCoordinador(profile)

    const db = getD1()

    if (profile.rol === 'coordinador') {
        const empleado = await db.prepare(
            'SELECT operacion FROM usuarios WHERE id = ?'
        ).bind(cedula).first<{ operacion: string }>()

        if (!empleado || empleado.operacion !== profile.operacion_nombre) {
            return { success: false, error: 'Solo puedes cambiar el estado de empleados de tu operación' }
        }
    }

    try {
        await db.prepare(
            'UPDATE usuarios SET status = ? WHERE id = ?'
        ).bind(status, cedula).run()
    } catch (err) {
        return { success: false, error: 'Error cambiando el estado del empleado' }
    }

    revalidatePath('/empleados')
    return { success: true }
}

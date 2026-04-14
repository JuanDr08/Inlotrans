'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getUserProfile, requireAdminOrCoordinador } from '@/lib/auth'

export async function crearEmpleado(formData: FormData) {
    const profile = await getUserProfile()
    requireAdminOrCoordinador(profile)

    const supabase = await createClient()

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

    const { error } = await supabase
        .from('usuarios')
        .insert([
            {
                id: cedula,
                nombre,
                cargo,
                operacion,
                birthdate: birthdate ? new Date(birthdate).toISOString() : null,
                status: 'activo',
                turno_id: turno_id || null,
                salario: salarioStr ? parseFloat(salarioStr) : null
            }
        ])

    if (error) {
        if (error.code === '23505') {
            return { success: false, error: 'Ya existe un empleado registrado con esa cédula' }
        }
        console.error('Error insertando empleado:', error)
        return { success: false, error: 'Error interno al registrar empleado' }
    }

    revalidatePath('/empleados')
    return { success: true }
}

export async function editarEmpleado(formData: FormData) {
    const profile = await getUserProfile()
    requireAdminOrCoordinador(profile)

    const supabase = await createClient()

    const cedula = formData.get('cedula') as string
    const nombre = formData.get('nombre') as string
    const cargo = formData.get('cargo') as string
    const operacion = formData.get('operacion') as string
    const status = formData.get('status') as string

    if (!cedula || !nombre || !cargo || !operacion || !status) {
        return { success: false, error: 'Todos los campos son obligatorios' }
    }

    if (profile.rol === 'coordinador') {
        const { data: empleado } = await supabase
            .from('usuarios')
            .select('operacion')
            .eq('id', cedula)
            .single()

        if (!empleado || empleado.operacion !== profile.operacion_nombre) {
            return { success: false, error: 'Solo puedes editar empleados de tu operación' }
        }
    }

    const turno_id = formData.get('turno_id') as string | null
    const salarioStr = formData.get('salario') as string | null
    const nuevaCedula = formData.get('nueva_cedula') as string | null

    const updateData: any = {
        nombre,
        cargo,
        operacion,
        status,
        turno_id: turno_id || null,
        salario: salarioStr ? parseFloat(salarioStr) : null
    }

    // Si se cambio la cedula, actualizar el ID (PK)
    if (nuevaCedula && nuevaCedula !== cedula) {
        updateData.id = nuevaCedula
    }

    const { error } = await supabase
        .from('usuarios')
        .update(updateData)
        .eq('id', cedula)

    if (error) {
        console.error('Error actualizando empleado:', error)
        return { success: false, error: 'Error interno al actualizar empleado' }
    }

    revalidatePath('/empleados')
    return { success: true }
}

export async function cambiarEstadoEmpleado(cedula: string, status: string) {
    const profile = await getUserProfile()
    requireAdminOrCoordinador(profile)

    const supabase = await createClient()

    if (profile.rol === 'coordinador') {
        const { data: empleado } = await supabase
            .from('usuarios')
            .select('operacion')
            .eq('id', cedula)
            .single()

        if (!empleado || empleado.operacion !== profile.operacion_nombre) {
            return { success: false, error: 'Solo puedes cambiar el estado de empleados de tu operación' }
        }
    }

    const { error } = await supabase
        .from('usuarios')
        .update({ status })
        .eq('id', cedula)

    if (error) {
        return { success: false, error: 'Error cambiando el estado del empleado' }
    }

    revalidatePath('/empleados')
    return { success: true }
}

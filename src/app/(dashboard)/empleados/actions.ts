'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function crearEmpleado(formData: FormData) {
    const supabase = await createClient()

    const cedula = formData.get('cedula') as string
    const nombre = formData.get('nombre') as string
    const cargo = formData.get('cargo') as string
    const operacion = formData.get('operacion') as string
    const birthdate = formData.get('birthdate') as string

    if (!cedula || !nombre || !cargo || !operacion) {
        return { success: false, error: 'Todos los campos marcados con * son obligatorios' }
    }

    const { error } = await supabase
        .from('usuarios')
        .insert([
            {
                id: cedula,
                nombre,
                cargo,
                operacion,
                birthdate: birthdate ? new Date(birthdate).toISOString() : null,
                status: 'activo'
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
    const supabase = await createClient()

    const cedula = formData.get('cedula') as string
    const nombre = formData.get('nombre') as string
    const cargo = formData.get('cargo') as string
    const operacion = formData.get('operacion') as string
    const status = formData.get('status') as string

    if (!cedula || !nombre || !cargo || !operacion || !status) {
        return { success: false, error: 'Todos los campos son obligatorios' }
    }

    const { error } = await supabase
        .from('usuarios')
        .update({
            nombre,
            cargo,
            operacion,
            status
        })
        .eq('id', cedula)

    if (error) {
        console.error('Error actualizando empleado:', error)
        return { success: false, error: 'Error interno al actualizar empleado' }
    }

    revalidatePath('/empleados')
    return { success: true }
}

export async function cambiarEstadoEmpleado(cedula: string, status: string) {
    const supabase = await createClient()

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

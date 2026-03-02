'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function crearNovedad(formData: FormData) {
    const supabase = await createClient()

    const usuario_id = formData.get('usuario_id') as string
    const tipo_novedad = formData.get('tipo_novedad') as string
    const fecha = formData.get('fechaNovedad') as string // general date
    const notas = formData.get('razon') as string
    const valor_monetario = formData.get('valor_monetario') as string
    const es_remunerado = formData.get('remunerable') as string
    const startDate = formData.get('startDate') as string
    const endDate = formData.get('endDate') as string
    const causa = formData.get('causa') as string

    if (!usuario_id || !tipo_novedad || !notas) {
        return { success: false, error: 'Faltan campos obligatorios' }
    }

    // Calcular inicio y fin dependiendo del tipo
    let start_date = null
    let end_date = null
    let fecha_novedad = null

    if (tipo_novedad === 'incapacidad' && startDate && endDate) {
        start_date = new Date(startDate).toISOString().split('T')[0]
        end_date = new Date(endDate).toISOString().split('T')[0]
        fecha_novedad = start_date // Default
    } else if (fecha) {
        fecha_novedad = new Date(fecha).toISOString().split('T')[0]
    } else {
        return { success: false, error: 'Falta especificar fecha de la novedad' }
    }

    // Validation to make sure user exists (Supabase will also enforce via FK)
    const { data: usuario } = await supabase.from('usuarios').select('id, nombre').eq('id', usuario_id).single()
    if (!usuario) {
        return { success: false, error: 'La cédula ingresada no corresponde a un empleado válido.' }
    }

    const { error } = await supabase
        .from('novedades')
        .insert([
            {
                usuario_id,
                usuario_nombre: usuario.nombre,
                tipo_novedad,
                fecha_novedad,
                start_date,
                end_date,
                valor_monetario: valor_monetario ? parseFloat(valor_monetario) : null,
                remunerable: es_remunerado === 'true',
                causa: causa ? parseInt(causa) : null,
                razon: notas,
            }
        ])

    if (error) {
        console.error('Error insertando novedad:', error)
        return { success: false, error: 'Error interno al registrar la novedad' }
    }

    revalidatePath('/novedades')
    return { success: true }
}

export async function eliminarNovedad(id: string) {
    const supabase = await createClient()

    const { error } = await supabase.from('novedades').delete().eq('id', id)

    if (error) {
        console.error('Error eliminando novedad:', error)
        return { success: false, error: 'No se pudo eliminar la novedad' }
    }

    revalidatePath('/novedades')
    return { success: true }
}

export async function buscarEmpleadoNombre(cedula: string) {
    const supabase = await createClient()
    const { data } = await supabase.from('usuarios').select('nombre').eq('id', cedula).single()
    return data?.nombre || null
}

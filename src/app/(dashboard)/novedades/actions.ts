'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getUserProfile, requireAdmin, requireAdminOrCoordinador } from '@/lib/auth'
import { registrarCompensaTiempo } from '@/lib/jornadas'

export async function crearNovedad(formData: FormData) {
    const profile = await getUserProfile()
    requireAdminOrCoordinador(profile)

    const supabase = await createClient()

    const usuario_id = formData.get('usuario_id') as string
    const tipo_novedad = formData.get('tipo_novedad') as string
    const descripcion = (formData.get('descripcion') as string) || null
    const valor_monetario_raw = formData.get('valor_monetario') as string | null
    const es_pagado_raw = formData.get('es_pagado') as string | null
    const codigo_causa_raw = formData.get('codigo_causa') as string | null
    const horas_compensa_raw = formData.get('horas_compensa') as string | null
    const fecha_unica = formData.get('fecha_novedad') as string | null
    const fecha_inicio_raw = formData.get('fecha_inicio') as string | null
    const fecha_fin_raw = formData.get('fecha_fin') as string | null

    if (!usuario_id || !tipo_novedad) {
        return { success: false, error: 'Faltan campos obligatorios' }
    }

    // Resolver fechas según si vino rango o fecha única
    let fecha_inicio: string | null = null
    let fecha_fin: string | null = null
    let fecha_novedad: string | null = null

    if (fecha_inicio_raw && fecha_fin_raw) {
        fecha_inicio = new Date(fecha_inicio_raw).toISOString().slice(0, 10)
        fecha_fin = new Date(fecha_fin_raw).toISOString().slice(0, 10)
        fecha_novedad = fecha_inicio
    } else if (fecha_unica) {
        fecha_novedad = new Date(fecha_unica).toISOString().slice(0, 10)
    } else {
        return { success: false, error: 'Falta especificar la fecha de la novedad' }
    }

    // Validar que el usuario existe y el coordinador pueda tocarlo
    const { data: usuario } = await supabase
        .from('usuarios')
        .select('id, nombre, operacion')
        .eq('id', usuario_id)
        .single()
    if (!usuario) {
        return { success: false, error: 'La cédula ingresada no corresponde a un empleado válido.' }
    }
    if (profile.rol === 'coordinador' && usuario.operacion !== profile.operacion_nombre) {
        return { success: false, error: 'Solo podés crear novedades para empleados de tu operación.' }
    }

    // Insertar la novedad con nombres semánticos
    const { data: novedad, error } = await supabase
        .from('novedades')
        .insert({
            usuario_id,
            usuario_nombre: usuario.nombre,
            tipo_novedad,
            fecha_novedad,
            fecha_inicio,
            fecha_fin,
            es_pagado: es_pagado_raw === 'true',
            codigo_causa: codigo_causa_raw ? parseInt(codigo_causa_raw, 10) : null,
            valor_monetario: valor_monetario_raw ? parseFloat(valor_monetario_raw) : null,
            descripcion,
        })
        .select('id')
        .single()

    if (error || !novedad) {
        console.error('Error insertando novedad:', error)
        return { success: false, error: 'Error interno al registrar la novedad.' }
    }

    // Si es COMPENSA_TIEMPO, descontar de la bolsa
    if (tipo_novedad === 'COMPENSA_TIEMPO') {
        const horas = parseFloat(horas_compensa_raw ?? '')
        if (!Number.isFinite(horas) || horas <= 0) {
            // Rollback de la novedad
            await supabase.from('novedades').delete().eq('id', novedad.id)
            return { success: false, error: 'Horas de compensación inválidas.' }
        }
        const minutos = Math.round(horas * 60)
        const res = await registrarCompensaTiempo({
            empleadoId: usuario_id,
            minutos,
            novedadId: novedad.id,
        })
        if (res.error) {
            await supabase.from('novedades').delete().eq('id', novedad.id)
            return { success: false, error: res.error }
        }
    }

    revalidatePath('/novedades')
    return { success: true }
}

export async function eliminarNovedad(id: string) {
    const profile = await getUserProfile()
    requireAdmin(profile)

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
    const { data } = await supabase
        .from('usuarios')
        .select('nombre')
        .eq('id', cedula)
        .single()
    return data?.nombre || null
}

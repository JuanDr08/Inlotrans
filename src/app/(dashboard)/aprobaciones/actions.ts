'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserProfile, requireAdminOrCoordinador, getOperationFilter } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function getAprobacionesPendientes() {
    const supabase = await createClient()
    const profile = await getUserProfile()
    requireAdminOrCoordinador(profile)
    const filtroOp = getOperationFilter(profile)

    const { data, error } = await supabase
        .from('aprobaciones_extras')
        .select(`
            id,
            minutos_solicitados,
            estado,
            created_at,
            empleado_id,
            jornada_id,
            jornadas ( entrada, salida, operacion, minutos_total ),
            usuarios!aprobaciones_extras_empleado_id_fkey ( nombre, operacion )
        `)
        .eq('estado', 'PENDIENTE')
        .order('created_at', { ascending: false })

    if (error) return { success: false, error: error.message, data: [] }

    const resultado = filtroOp.length > 0
        ? (data ?? []).filter((ap: any) => filtroOp.includes(ap.jornadas?.operacion))
        : (data ?? [])

    return { success: true, data: resultado }
}

export async function aprobarExtras(aprobacionId: string, nota?: string) {
    const supabase = await createClient()
    const profile = await getUserProfile()
    requireAdminOrCoordinador(profile)

    const { error } = await supabase
        .from('aprobaciones_extras')
        .update({
            estado: 'APROBADA',
            coordinador_id: profile.userId,
            nota_coordinador: nota ?? null,
            updated_at: new Date().toISOString(),
        })
        .eq('id', aprobacionId)

    if (error) return { success: false, error: error.message }
    revalidatePath('/aprobaciones')
    return { success: true }
}

export async function rechazarExtras(aprobacionId: string, nota: string) {
    const supabase = await createClient()
    const profile = await getUserProfile()
    requireAdminOrCoordinador(profile)

    const { error } = await supabase
        .from('aprobaciones_extras')
        .update({
            estado: 'RECHAZADA',
            coordinador_id: profile.userId,
            nota_coordinador: nota,
            updated_at: new Date().toISOString(),
        })
        .eq('id', aprobacionId)

    if (error) return { success: false, error: error.message }
    revalidatePath('/aprobaciones')
    return { success: true }
}

export async function getJornadasInconsistentes() {
    const supabase = await createClient()
    const profile = await getUserProfile()
    requireAdminOrCoordinador(profile)
    const filtroOp = getOperationFilter(profile)

    let query = supabase
        .from('jornadas')
        .select(`
            id,
            empleado_id,
            operacion,
            entrada,
            estado,
            created_at,
            usuarios!jornadas_empleado_id_fkey (
                nombre
            )
        `)
        .eq('estado', 'INCONSISTENTE')
        .order('entrada', { ascending: false })

    if (filtroOp.length > 0) query = query.in('operacion', filtroOp)

    const { data, error } = await query
    if (error) return { success: false, error: error.message, data: [] }
    return { success: true, data: data ?? [] }
}

export async function corregirInconsistente(jornadaId: string, horaSalidaISO: string) {
    const supabase = await createClient()
    const profile = await getUserProfile()
    requireAdminOrCoordinador(profile)

    const { corregirJornadaInconsistente } = await import('@/lib/jornadas')
    const { data, error } = await corregirJornadaInconsistente(jornadaId, new Date(horaSalidaISO))
    if (error || !data) return { success: false, error: error ?? 'Error al corregir jornada' }

    // corregirJornadaInconsistente ya marca las alertas INCONSISTENTE como leídas,
    // pero lo repetimos por seguridad para cualquier alerta remanente.
    await supabase
        .from('alertas')
        .update({ leida: true })
        .eq('jornada_id', jornadaId)
        .eq('tipo', 'INCONSISTENTE')

    revalidatePath('/aprobaciones')
    return { success: true }
}

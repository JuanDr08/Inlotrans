'use server'

import { createClient } from '@/lib/supabase/server'

export async function getEmpleadoDetalle(cedula: string) {
    const supabase = await createClient()

    const { data: empleado, error } = await supabase
        .from('usuarios')
        .select('*, turno:turnos(id, nombre, hora_inicio, hora_fin)')
        .eq('id', cedula)
        .single()

    if (error || !empleado) return null
    return empleado
}

export async function getRegistrosPorDia(cedula: string, fecha: string) {
    const supabase = await createClient()

    // fecha es YYYY-MM-DD, buscar todo el dia en UTC
    const inicio = new Date(fecha + 'T00:00:00.000Z')
    const fin = new Date(fecha + 'T23:59:59.999Z')

    // Expandir rango para cubrir zona horaria Colombia (UTC-5)
    inicio.setHours(inicio.getHours() - 5)
    fin.setHours(fin.getHours() + 19) // cubrir hasta fin del dia Colombia

    const { data, error } = await supabase
        .from('registros')
        .select('row_number, tipo, fecha_hora, operacion, foto_base64')
        .eq('id', cedula)
        .gte('fecha_hora', inicio.toISOString())
        .lte('fecha_hora', fin.toISOString())
        .order('fecha_hora', { ascending: true })

    if (error) return []
    return data || []
}

export async function getRegistrosRango(cedula: string, fechaInicio: string, fechaFin: string) {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('registros')
        .select('row_number, tipo, fecha_hora, operacion')
        .eq('id', cedula)
        .gte('fecha_hora', fechaInicio)
        .lte('fecha_hora', fechaFin)
        .order('fecha_hora', { ascending: true })

    if (error) return []
    return data || []
}

export async function getNovedadesEmpleado(cedula: string) {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('novedades')
        .select('*')
        .eq('usuario_id', cedula)
        .order('created_at', { ascending: false })
        .limit(20)

    if (error) return []
    return data || []
}

'use server'

import { createClient } from '@/lib/supabase/server'

export async function validarCedula(cedula: string) {
    if (!cedula) return { success: false, error: 'Cédula vacía' }

    const supabase = await createClient()

    // Intentamos buscar con el auth actual (anon)
    const { data: usuario, error } = await supabase
        .from('usuarios')
        .select('id, nombre, status, operacion')
        .eq('id', cedula)
        .single()

    if (error || !usuario) {
        console.error("Error validando cédula (Posible bloqueo RLS):", error)
        return { success: false, error: 'Usuario no encontrado o sin permisos' }
    }

    if (usuario.status === 'inactivo') {
        return { success: false, error: 'Usuario inactivo. No puede registrar asistencias.' }
    }

    return { success: true, data: usuario }
}

export async function getUltimoRegistro(cedula: string) {
    const supabase = await createClient()

    const { data: registro, error } = await supabase
        .from('registros')
        .select('*')
        .eq('id', cedula)
        .order('fecha_hora', { ascending: false })
        .limit(1)
        .single()

    if (error || !registro) {
        return { success: false }
    }

    return { success: true, data: registro }
}

export async function registrarAsistenciaAPI({
    id,
    usuario_nombre,
    operacion,
    tipo,
    foto_base64 // New parameter
}: {
    id: string
    usuario_nombre: string
    operacion: string
    tipo: string
    foto_base64: string
}) {
    try {
        const supabase = await createClient()

        // Server time - Hora Colombia approximation / local Vercel time
        // using ISO string representation directly
        const fechaHora = new Date().toISOString()

        // Additional Backend Validations
        const ultimoReg = await getUltimoRegistro(id)
        if (ultimoReg.success && ultimoReg.data) {
            if (ultimoReg.data.tipo === tipo) {
                return { success: false, error: `No se puede registrar ${tipo} porque el último registro también fue ${ultimoReg.data.tipo}.` }
            }
        }

        const { data: insertData, error } = await supabase
            .from('registros')
            .insert({
                id,
                usuario_nombre,
                operacion,
                tipo,
                fecha_hora: fechaHora,
                foto_base64 // Nueva columna (foto_url was completely dropped as requested)
            })
            .select()

        if (error) {
            console.error('[Supabase Insert Error]', error)
            return { success: false, error: 'Error interno en la BD: ' + error.message }
        }

        return { success: true, data: insertData[0] }
    } catch (error: any) {
        console.error('[registrarAsistenciaAPI] Exception:', error)
        return { success: false, error: error.message || 'Error del Servidor' }
    }
}

'use server'

import { createClient } from '@/lib/supabase/server'
import {
    abrirJornada,
    cerrarJornada,
    obtenerJornadaActiva,
    tieneJornadasInconsistentes,
} from '@/lib/jornadas'

export async function validarCedula(cedula: string) {
    if (!cedula) return { success: false, error: 'Cédula vacía' }

    const supabase = await createClient()
    const { data: usuario, error } = await supabase
        .from('usuarios')
        .select('id, nombre, status, operacion')
        .eq('id', cedula)
        .maybeSingle()

    if (error && error.code !== 'PGRST116') {
        console.error('Error validando cédula:', error)
    }
    if (!usuario) return { success: false, error: 'Usuario no encontrado o sin permisos' }
    if (usuario.status === 'inactivo') {
        return { success: false, error: 'Usuario inactivo. No puede registrar asistencias.' }
    }
    return { success: true, data: usuario }
}

export async function getEstadoJornada(cedula: string) {
    const jornada = await obtenerJornadaActiva(cedula)
    const tieneInconsistentes = await tieneJornadasInconsistentes(cedula)

    if (!jornada) {
        return {
            success: true,
            data: { estado: 'sin_turno' as const, tieneInconsistentes, jornada: null },
        }
    }

    const fechaEntrada = new Date(jornada.entrada)
    const hora = fechaEntrada.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })

    return {
        success: true,
        data: {
            estado: 'trabajando' as const,
            tieneInconsistentes,
            jornada,
            info: `En turno desde ${hora}`,
        },
    }
}

interface RegistrarAsistenciaInput {
    id: string
    usuario_nombre: string
    operacion: string
    tipo: 'ENTRADA' | 'SALIDA'
    // La foto es obligatoria en el cliente pero NO se almacena. Se recibe
    // como marcador de que el empleado pasó el ritual del kiosco.
    foto_base64: string | null
}

export async function registrarAsistenciaAPI(input: RegistrarAsistenciaInput) {
    try {
        if (!input.foto_base64) {
            return { success: false, error: 'Es obligatorio registrar una foto.' }
        }
        // Nota: la foto se recibe pero se descarta — no se persiste en ningún lado.

        if (input.tipo === 'ENTRADA') {
            const activa = await obtenerJornadaActiva(input.id)
            if (activa) {
                return {
                    success: false,
                    error: 'Ya tenés una jornada activa. Registrá la salida primero.',
                }
            }

            const { error } = await abrirJornada(input.id, input.operacion)
            if (error) return { success: false, error }
            return { success: true }
        }

        if (input.tipo === 'SALIDA') {
            const activa = await obtenerJornadaActiva(input.id)
            if (!activa) {
                return {
                    success: false,
                    error: 'No tenés una jornada activa. Registrá la entrada primero.',
                }
            }

            const { error } = await cerrarJornada(input.id)
            if (error) return { success: false, error }
            return { success: true }
        }

        return { success: false, error: 'Tipo de registro no válido.' }
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error del servidor'
        console.error('[registrarAsistenciaAPI]', err)
        return { success: false, error: msg }
    }
}

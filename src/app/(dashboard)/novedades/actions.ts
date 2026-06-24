'use server'

import { getD1, generateId } from '@/lib/d1/client'
import { revalidatePath } from 'next/cache'
import { getUserProfile } from '@/lib/auth'
import { requireAdmin, requireAdminOrCoordinador } from '@/lib/auth-helpers'
import { registrarCompensaTiempo } from '@/lib/jornadas'
import { redondearMediaHora } from '@/lib/calculoHoras'

export async function crearNovedad(formData: FormData) {
    const profile = await getUserProfile()
    requireAdminOrCoordinador(profile)

    const db = getD1()

    const usuario_id = formData.get('usuario_id') as string
    const tipo_novedad = formData.get('tipo_novedad') as string
    const descripcion = (formData.get('descripcion') as string) || null
    const valor_monetario_raw = formData.get('valor_monetario') as string | null
    const es_pagado_raw = formData.get('es_pagado') as string | null
    const codigo_causa_raw = formData.get('codigo_causa') as string | null
    const tipo_ausentismo_raw = formData.get('tipo_ausentismo') as string | null
    const horas_compensa_raw = formData.get('horas_compensa') as string | null
    const fecha_unica = formData.get('fecha_novedad') as string | null
    const fecha_inicio_raw = formData.get('fecha_inicio') as string | null
    const fecha_fin_raw = formData.get('fecha_fin') as string | null

    if (!usuario_id || !tipo_novedad) {
        return { success: false, error: 'Faltan campos obligatorios' }
    }

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

    const usuario = await db.prepare(
        'SELECT id, nombre, operacion FROM usuarios WHERE id = ?'
    ).bind(usuario_id).first<{ id: string; nombre: string; operacion: string }>()

    if (!usuario) {
        return { success: false, error: 'La cédula ingresada no corresponde a un empleado válido.' }
    }
    if (profile.rol === 'coordinador' && usuario.operacion !== profile.operacion_nombre) {
        return { success: false, error: 'Solo podés crear novedades para empleados de tu operación.' }
    }

    const novedadId = generateId()

    try {
        await db.prepare(
            `INSERT INTO novedades (id, usuario_id, usuario_nombre, tipo_novedad, fecha_novedad,
                fecha_inicio, fecha_fin, es_pagado, codigo_causa, tipo_ausentismo,
                valor_monetario, descripcion)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            novedadId,
            usuario_id,
            usuario.nombre,
            tipo_novedad,
            fecha_novedad,
            fecha_inicio,
            fecha_fin,
            es_pagado_raw === 'true' ? 1 : 0,
            codigo_causa_raw ? parseInt(codigo_causa_raw, 10) : null,
            tipo_ausentismo_raw ? parseInt(tipo_ausentismo_raw, 10) : null,
            valor_monetario_raw ? parseFloat(valor_monetario_raw) : null,
            descripcion,
        ).run()
    } catch (err) {
        console.error('Error insertando novedad:', err)
        return { success: false, error: 'Error interno al registrar la novedad.' }
    }

    if (tipo_novedad === 'COMPENSA_TIEMPO') {
        const horas = parseFloat(horas_compensa_raw ?? '')
        if (!Number.isFinite(horas) || horas <= 0) {
            await db.prepare('DELETE FROM novedades WHERE id = ?').bind(novedadId).run()
            return { success: false, error: 'Horas de compensación inválidas.' }
        }
        const minutos = redondearMediaHora(Math.round(horas * 60))
        const res = await registrarCompensaTiempo({
            empleadoId: usuario_id,
            minutos,
            novedadId,
        })
        if (res.error) {
            await db.prepare('DELETE FROM novedades WHERE id = ?').bind(novedadId).run()
            return { success: false, error: res.error }
        }
    }

    revalidatePath('/novedades')
    return { success: true }
}

export async function eliminarNovedad(id: string) {
    const profile = await getUserProfile()
    requireAdmin(profile)

    try {
        const db = getD1()
        await db.prepare('DELETE FROM novedades WHERE id = ?').bind(id).run()
    } catch (err) {
        console.error('Error eliminando novedad:', err)
        return { success: false, error: 'No se pudo eliminar la novedad' }
    }

    revalidatePath('/novedades')
    return { success: true }
}

export async function buscarEmpleadoNombre(cedula: string) {
    const db = getD1()
    const data = await db.prepare(
        'SELECT nombre FROM usuarios WHERE id = ?'
    ).bind(cedula).first<{ nombre: string }>()
    return data?.nombre || null
}

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
    try {
        const supabase = await createClient()

        // 1. Check for last events to emulate autocierreHoras.js missing WITH query logic securely using NextJS Array filtering
        // Fetch last 48 hrs entries instead of full DB
        const limits = new Date()
        limits.setHours(limits.getHours() - 48)
        const limitsIso = limits.toISOString()

        const { data: registros, error } = await supabase
            .from('registros')
            .select('row_number, id, usuario_nombre, operacion, tipo, fecha_hora')
            .gte('fecha_hora', limitsIso)
            .order('fecha_hora', { ascending: true })

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 })
        }

        if (!registros || registros.length === 0) {
            return NextResponse.json({ success: true, message: 'No hay entradas recientes' })
        }

        // Identify Open Entries (Entradas missing a Salida)
        const latestStateByUser: Record<string, any> = {}

        registros.forEach((reg) => {
            if (reg.tipo === 'ENTRADA') {
                latestStateByUser[reg.id] = reg
            } else if (reg.tipo === 'SALIDA') {
                // If there is an entry then output dismisses the entry
                if (latestStateByUser[reg.id]) {
                    delete latestStateByUser[reg.id]
                }
            }
        })

        const nowTime = new Date().getTime()
        const limitHours = 8 * 60 * 60 * 1000 // 8 hours mapped in MS

        const entradasAbiertas = Object.values(latestStateByUser).filter((entrada: any) => {
            const entradaTime = new Date(entrada.fecha_hora).getTime()
            return (nowTime - entradaTime) >= limitHours
        })

        if (entradasAbiertas.length === 0) {
            return NextResponse.json({
                success: true,
                mensaje: 'No hay entradas pendientes de cierre automático',
                registros_cerrados: 0,
                detalles: []
            })
        }

        const detalles = []

        for (const entrada of entradasAbiertas) {
            const dateSalida = new Date(new Date(entrada.fecha_hora).getTime() + limitHours)

            const { data: salidaResult, error: insertError } = await supabase
                .from('registros')
                .insert({
                    id: entrada.id,
                    usuario_nombre: entrada.usuario_nombre,
                    operacion: entrada.operacion,
                    tipo: 'SALIDA',
                    fecha_hora: dateSalida.toISOString(),
                    foto_url: null
                })
                .select()

            if (insertError) {
                console.error('Error insertando cierre automatico:', insertError)
                continue
            }

            detalles.push({
                cedula: entrada.id,
                nombre: entrada.usuario_nombre,
                entrada: entrada.fecha_hora,
                salida_automatica: dateSalida.toISOString(),
                registro_salida_id: salidaResult?.[0]?.row_number
            })
        }

        return NextResponse.json({
            success: true,
            mensaje: `Se cerraron automáticamente ${detalles.length} entradas`,
            registros_cerrados: detalles.length,
            detalles
        })

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}

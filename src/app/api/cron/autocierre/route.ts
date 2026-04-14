import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Vercel crons ALWAYS use GET — this MUST be a GET handler
export async function GET(request: NextRequest) {
    try {
        // Optional: Verify the request comes from Vercel Cron
        // If you set CRON_SECRET in Vercel env vars, Vercel sends it in the Authorization header
        const authHeader = request.headers.get('authorization')
        if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Use the service role key directly — cron jobs have NO user session/cookies
        // The server.ts createClient() depends on cookies() which is empty for cron requests
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ 
                success: false, 
                error: 'Missing SUPABASE env vars for cron' 
            }, { status: 500 })
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // Fetch entries from the last 48 hours
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
            return NextResponse.json({ success: true, message: 'No hay entradas recientes', registros_cerrados: 0 })
        }

        // Rastrear estado actual de cada usuario: ENTRADA, PAUSA_INICIO, PAUSA_FIN o cerrado
        const userState: Record<string, { entrada: any; ultimoTipo: string }> = {}

        registros.forEach((reg) => {
            if (reg.tipo === 'ENTRADA') {
                userState[reg.id] = { entrada: reg, ultimoTipo: 'ENTRADA' }
            } else if (reg.tipo === 'SALIDA') {
                delete userState[reg.id]
            } else if (reg.tipo === 'PAUSA_INICIO' || reg.tipo === 'PAUSA_FIN') {
                if (userState[reg.id]) {
                    userState[reg.id].ultimoTipo = reg.tipo
                }
            }
        })

        const nowTime = new Date().getTime()
        const limitHours = 8 * 60 * 60 * 1000 // 8 hours in ms

        // Filtrar turnos abiertos que superan las 8h desde la ENTRADA original
        const turnosAbiertos = Object.values(userState).filter((state: any) => {
            const entradaTime = new Date(state.entrada.fecha_hora).getTime()
            return (nowTime - entradaTime) >= limitHours
        })

        if (turnosAbiertos.length === 0) {
            return NextResponse.json({
                success: true,
                mensaje: 'No hay entradas pendientes de cierre automático',
                registros_cerrados: 0,
                detalles: []
            })
        }

        const detalles = []

        for (const state of turnosAbiertos) {
            const entrada = state.entrada as any
            const dateSalida = new Date(new Date(entrada.fecha_hora).getTime() + limitHours)

            // Si el ultimo registro es PAUSA_INICIO, cerrar la pausa primero
            if (state.ultimoTipo === 'PAUSA_INICIO') {
                await supabase
                    .from('registros')
                    .insert({
                        id: entrada.id,
                        usuario_nombre: entrada.usuario_nombre,
                        operacion: entrada.operacion,
                        tipo: 'PAUSA_FIN',
                        fecha_hora: dateSalida.toISOString(),
                        foto_base64: null
                    })
            }

            // Insertar SALIDA automatica
            const { data: salidaResult, error: insertError } = await supabase
                .from('registros')
                .insert({
                    id: entrada.id,
                    usuario_nombre: entrada.usuario_nombre,
                    operacion: entrada.operacion,
                    tipo: 'SALIDA',
                    fecha_hora: dateSalida.toISOString(),
                    foto_base64: null
                })
                .select()

            if (insertError) {
                console.error('Error insertando cierre automático:', insertError)
                continue
            }

            detalles.push({
                cedula: entrada.id,
                nombre: entrada.usuario_nombre,
                entrada: entrada.fecha_hora,
                salida_automatica: dateSalida.toISOString(),
                pausa_cerrada: state.ultimoTipo === 'PAUSA_INICIO',
                registro_salida_id: salidaResult?.[0]?.row_number
            })
        }

        console.log(`[CRON AUTOCIERRE] ${new Date().toISOString()} - Cerradas ${detalles.length} entradas`)

        return NextResponse.json({
            success: true,
            mensaje: `Se cerraron automáticamente ${detalles.length} entradas`,
            registros_cerrados: detalles.length,
            detalles
        })

    } catch (error: any) {
        console.error('[CRON AUTOCIERRE] Error:', error.message)
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}

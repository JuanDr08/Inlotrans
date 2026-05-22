import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { generarPlanoCumpleanos, type NovedadCumpleanos } from '@/lib/excel/planos/cumpleanos'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ error: 'Config error' }, { status: 500 })
        }
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        const { searchParams } = new URL(request.url)
        const anio = parseInt(searchParams.get('anio') ?? '')
        const mes = parseInt(searchParams.get('mes') ?? '')
        const quincena = parseInt(searchParams.get('quincena') ?? '')

        if (!anio || !mes || ![1, 2].includes(quincena)) {
            return NextResponse.json(
                { error: 'Parámetros requeridos: anio, mes (1-12), quincena (1 o 2)' },
                { status: 400 },
            )
        }

        const pad = (n: number) => String(n).padStart(2, '0')
        const lastDay = new Date(anio, mes, 0).getDate()

        const start = `${anio}-${pad(mes)}-${quincena === 1 ? '01' : '16'}`
        const end = `${anio}-${pad(mes)}-${quincena === 1 ? '15' : pad(lastDay)}`

        const { data: novedades, error } = await supabase
            .from('novedades')
            .select('usuario_id, fecha_novedad')
            .eq('tipo_novedad', 'DIA_CUMPLEANOS')
            .gte('fecha_novedad', start)
            .lte('fecha_novedad', end)
            .order('fecha_novedad', { ascending: true })

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        const datos: NovedadCumpleanos[] = (novedades ?? []).map((n) => ({
            cedula: n.usuario_id,
            fecha_novedad: n.fecha_novedad,
        }))

        const buffer = await generarPlanoCumpleanos(datos)

        const filename = `plano_cumpleanos_${anio}-${pad(mes)}_${quincena}Q.xlsx`
        return new NextResponse(new Uint8Array(buffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        })
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error interno'
        console.error('[API /reportes/planos/cumpleanos]', err)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}

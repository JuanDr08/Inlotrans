import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { generarPlanoOtro, type NovedadGenericaPlano } from '@/lib/excel/planos/otro'

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
        const tipo = parseInt(searchParams.get('tipo') ?? '')
        const causa = parseInt(searchParams.get('causa') ?? '')
        const clase = parseInt(searchParams.get('clase') ?? '')

        if (!anio || !mes || ![1, 2].includes(quincena) || !tipo || !causa || ![1, 2, 3].includes(clase)) {
            return NextResponse.json(
                { error: 'Parámetros requeridos: anio, mes, quincena, tipo, causa, clase' },
                { status: 400 },
            )
        }

        const esPagado = clase === 1

        const pad = (n: number) => String(n).padStart(2, '0')
        const lastDay = new Date(anio, mes, 0).getDate()

        const start = `${anio}-${pad(mes)}-${quincena === 1 ? '01' : '16'}`
        const end = `${anio}-${pad(mes)}-${quincena === 1 ? '15' : pad(lastDay)}`

        let query = supabase
            .from('novedades')
            .select('usuario_id, fecha_novedad, fecha_inicio, fecha_fin, es_pagado')
            .eq('tipo_ausentismo', tipo)
            .eq('codigo_causa', causa)
            .or(
                `and(fecha_novedad.gte.${start},fecha_novedad.lte.${end}),and(fecha_inicio.lte.${end},fecha_fin.gte.${start})`,
            )
            .order('fecha_novedad', { ascending: true })

        if (clase === 1 || clase === 2) {
            query = query.eq('es_pagado', esPagado)
        }

        const { data: novedades, error } = await query

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        const datos: NovedadGenericaPlano[] = (novedades ?? []).map((n) => ({
            cedula: n.usuario_id,
            fecha_novedad: n.fecha_novedad,
            fecha_inicio: n.fecha_inicio,
            fecha_fin: n.fecha_fin,
            es_pagado: n.es_pagado,
        }))

        const buffer = await generarPlanoOtro(datos, tipo, clase, causa)

        const filename = `plano_ausentismo_${tipo}_${causa}_${anio}-${pad(mes)}_${quincena}Q.xlsx`
        return new NextResponse(new Uint8Array(buffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        })
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error interno'
        console.error('[API /reportes/planos/otro]', err)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}

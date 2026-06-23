import { NextRequest, NextResponse } from 'next/server'
import { generarPlanoCumpleanos, type NovedadCumpleanos } from '@/lib/excel/planos/cumpleanos'
import { getD1 } from '@/lib/d1/client'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    try {
        const db = getD1()

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

        const { results: novedades } = await db
            .prepare(
                `SELECT usuario_id, fecha_novedad FROM novedades
                 WHERE tipo_novedad = 'DIA_CUMPLEANOS'
                 AND fecha_novedad >= ? AND fecha_novedad <= ?
                 ORDER BY fecha_novedad ASC`,
            )
            .bind(start, end)
            .all()

        const datos: NovedadCumpleanos[] = ((novedades ?? []) as Record<string, unknown>[]).map((n: Record<string, unknown>) => ({
            cedula: n.usuario_id as string,
            fecha_novedad: n.fecha_novedad as string,
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

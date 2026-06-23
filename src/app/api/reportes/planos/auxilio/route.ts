import { NextRequest, NextResponse } from 'next/server'
import { generarPlanoAuxilio, type NovedadAuxilio } from '@/lib/excel/planos/auxilio'
import { getD1 } from '@/lib/d1/client'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    try {
        const db = getD1()

        const { searchParams } = new URL(request.url)
        const anio = parseInt(searchParams.get('anio') ?? '')
        const mes = parseInt(searchParams.get('mes') ?? '')
        const quincena = parseInt(searchParams.get('quincena') ?? '') as 1 | 2

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
                `SELECT usuario_id, valor_monetario FROM novedades
                 WHERE tipo_novedad = 'AUXILIO_NO_PRESTACIONAL'
                 AND fecha_novedad >= ? AND fecha_novedad <= ?
                 ORDER BY fecha_novedad ASC`,
            )
            .bind(start, end)
            .all()

        const datos: NovedadAuxilio[] = ((novedades ?? []) as Record<string, unknown>[]).map((n: Record<string, unknown>) => ({
            cedula: n.usuario_id as string,
            valor: (n.valor_monetario as number) ?? 0,
        }))

        const periodo = { anio, mes, quincena }
        const buffer = await generarPlanoAuxilio(datos, periodo)

        const filename = `plano_auxilio_${anio}-${pad(mes)}_${quincena}Q.xlsx`
        return new NextResponse(new Uint8Array(buffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        })
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error interno'
        console.error('[API /reportes/planos/auxilio]', err)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}

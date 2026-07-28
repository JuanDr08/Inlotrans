import { NextRequest, NextResponse } from 'next/server'
import { generarPlanoCumpleanos, type NovedadCumpleanos } from '@/lib/excel/planos/cumpleanos'
import { getD1 } from '@/lib/d1/client'
import { getUserProfileFromRequest } from '@/lib/auth-route'
import { getOperationFilter } from '@/lib/auth-helpers'

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

        const profile = await getUserProfileFromRequest(request)
        if (!profile) {
            return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
        }
        const filtroOp = getOperationFilter(profile)

        const pad = (n: number) => String(n).padStart(2, '0')
        const lastDay = new Date(anio, mes, 0).getDate()

        const start = `${anio}-${pad(mes)}-${quincena === 1 ? '01' : '16'}`
        const end = `${anio}-${pad(mes)}-${quincena === 1 ? '15' : pad(lastDay)}`

        let novedadSql = `SELECT n.usuario_id, n.fecha_novedad FROM novedades n
                 INNER JOIN usuarios u ON u.id = n.usuario_id
                 WHERE n.tipo_novedad = 'DIA_CUMPLEANOS'
                 AND n.fecha_novedad >= ? AND n.fecha_novedad <= ?`
        const binds: unknown[] = [start, end]

        if (filtroOp.length > 0) {
            const ph = filtroOp.map(() => '?').join(', ')
            novedadSql += ` AND u.operacion IN (${ph})`
            binds.push(...filtroOp)
        }
        novedadSql += ' ORDER BY n.fecha_novedad ASC'

        const { results: novedades } = await db.prepare(novedadSql).bind(...binds).all()

        const datos: NovedadCumpleanos[] = ((novedades ?? []) as Record<string, unknown>[]).map((n: Record<string, unknown>) => ({
            cedula: n.usuario_id as string,
            fecha_novedad: n.fecha_novedad as string,
        }))

        const buffer = generarPlanoCumpleanos(datos)

        const filename = `plano_cumpleanos_${anio}-${pad(mes)}_${quincena}Q.xlsx`
        return new NextResponse(buffer.buffer as ArrayBuffer, {
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

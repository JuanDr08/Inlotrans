import { NextRequest, NextResponse } from 'next/server'
import { generarPlanoAuxilio, type NovedadAuxilio } from '@/lib/excel/planos/auxilio'
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
        const quincena = parseInt(searchParams.get('quincena') ?? '') as 1 | 2

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

        let novedadSql = `SELECT n.usuario_id, n.valor_monetario FROM novedades n
                 INNER JOIN usuarios u ON u.id = n.usuario_id
                 WHERE n.tipo_novedad = 'AUXILIO_NO_PRESTACIONAL'
                 AND n.fecha_novedad >= ? AND n.fecha_novedad <= ?`
        const binds: unknown[] = [start, end]

        if (filtroOp.length > 0) {
            const ph = filtroOp.map(() => '?').join(', ')
            novedadSql += ` AND u.operacion IN (${ph})`
            binds.push(...filtroOp)
        }
        novedadSql += ' ORDER BY n.fecha_novedad ASC'

        const { results: novedades } = await db.prepare(novedadSql).bind(...binds).all()

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

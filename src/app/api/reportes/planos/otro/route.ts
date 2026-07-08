import { NextRequest, NextResponse } from 'next/server'
import { generarPlanoOtro, type NovedadGenericaPlano } from '@/lib/excel/planos/otro'
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
        const tipo = parseInt(searchParams.get('tipo') ?? '')
        const causa = parseInt(searchParams.get('causa') ?? '')
        const clase = parseInt(searchParams.get('clase') ?? '')

        if (!anio || !mes || ![1, 2].includes(quincena) || !tipo || !causa || ![1, 2, 3].includes(clase)) {
            return NextResponse.json(
                { error: 'Parámetros requeridos: anio, mes, quincena, tipo, causa, clase' },
                { status: 400 },
            )
        }

        const profile = await getUserProfileFromRequest(request)
        if (!profile) {
            return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
        }
        const filtroOp = getOperationFilter(profile)

        const esPagado = clase === 1

        const pad = (n: number) => String(n).padStart(2, '0')
        const lastDay = new Date(anio, mes, 0).getDate()

        const start = `${anio}-${pad(mes)}-${quincena === 1 ? '01' : '16'}`
        const end = `${anio}-${pad(mes)}-${quincena === 1 ? '15' : pad(lastDay)}`

        let sql = `SELECT n.usuario_id, n.fecha_novedad, n.fecha_inicio, n.fecha_fin, n.es_pagado
                   FROM novedades n
                   INNER JOIN usuarios u ON u.id = n.usuario_id
                   WHERE n.tipo_ausentismo = ? AND n.codigo_causa = ?
                   AND ((n.fecha_novedad >= ? AND n.fecha_novedad <= ?) OR (n.fecha_inicio <= ? AND n.fecha_fin >= ?))`

        const bindValues: unknown[] = [tipo, causa, start, end, end, start]

        if (clase === 1 || clase === 2) {
            sql += ' AND n.es_pagado = ?'
            bindValues.push(esPagado ? 1 : 0)
        }

        if (filtroOp.length > 0) {
            const ph = filtroOp.map(() => '?').join(', ')
            sql += ` AND u.operacion IN (${ph})`
            bindValues.push(...filtroOp)
        }

        sql += ' ORDER BY n.fecha_novedad ASC'

        const { results: novedades } = await db.prepare(sql).bind(...bindValues).all()

        const datos: NovedadGenericaPlano[] = ((novedades ?? []) as Record<string, unknown>[]).map((n: Record<string, unknown>) => ({
            cedula: n.usuario_id as string,
            fecha_novedad: n.fecha_novedad as string,
            fecha_inicio: n.fecha_inicio as string,
            fecha_fin: n.fecha_fin as string,
            es_pagado: n.es_pagado === 1,
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

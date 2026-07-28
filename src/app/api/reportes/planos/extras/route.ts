import { NextRequest, NextResponse } from 'next/server'
import { generarPlanoExtras, type LineaExtra } from '@/lib/excel/planos/extras'
import { getD1 } from '@/lib/d1/client'
import { getUserProfileFromRequest } from '@/lib/auth-route'
import { getOperationFilter } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

const CODIGO_MAP: Record<string, number> = {
    minutos_extras_ordinarias: 11001,
    minutos_extras_nocturnas: 11002,
    minutos_extras_dominical_festivo: 11003,
    minutos_extras_nocturna_dominical_festivo: 11004,
    minutos_nocturnas: 11501,
    minutos_festivos: 11502,
    minutos_domingos_festivos_nocturnos: 11503,
}

const MINUTO_FIELDS = Object.keys(CODIGO_MAP)

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
        const startDay = quincena === 1 ? 1 : 16
        const endDay = quincena === 1 ? 15 : lastDay

        const startUTC = new Date(`${anio}-${pad(mes)}-${pad(startDay)}T05:00:00Z`)
        const endUTC = new Date(`${anio}-${pad(mes)}-${pad(endDay)}T05:00:00Z`)
        endUTC.setUTCDate(endUTC.getUTCDate() + 1)

        let aprobacionesSql = `SELECT ae.jornada_id FROM aprobaciones_extras ae
                 INNER JOIN jornadas j ON j.id = ae.jornada_id
                 WHERE ae.estado = 'APROBADA'
                 AND j.entrada >= ? AND j.entrada < ?`
        const aprobBinds: unknown[] = [startUTC.toISOString(), endUTC.toISOString()]

        if (filtroOp.length > 0) {
            const ph = filtroOp.map(() => '?').join(', ')
            aprobacionesSql += ` AND j.operacion IN (${ph})`
            aprobBinds.push(...filtroOp)
        }

        const { results: aprobaciones } = await db
            .prepare(aprobacionesSql)
            .bind(...aprobBinds)
            .all()

        const jornadaIdsAprobadas = new Set(
            ((aprobaciones ?? []) as Record<string, unknown>[]).map((a: Record<string, unknown>) => a.jornada_id as string),
        )

        let jornadasSql = `SELECT id, empleado_id,
                        minutos_extras_ordinarias, minutos_extras_nocturnas,
                        minutos_extras_dominical_festivo, minutos_extras_nocturna_dominical_festivo,
                        minutos_nocturnas, minutos_festivos, minutos_domingos,
                        minutos_domingos_festivos_nocturnos
                 FROM jornadas
                 WHERE estado IN ('CERRADO', 'CERRADO_MANUAL')
                 AND entrada >= ? AND entrada < ?`
        const jorBinds: unknown[] = [startUTC.toISOString(), endUTC.toISOString()]

        if (filtroOp.length > 0) {
            const ph = filtroOp.map(() => '?').join(', ')
            jornadasSql += ` AND operacion IN (${ph})`
            jorBinds.push(...filtroOp)
        }

        const { results: jornadas } = await db
            .prepare(jornadasSql)
            .bind(...jorBinds)
            .all()

        const agg = new Map<string, number>()

        for (const j of jornadas ?? []) {
            const cedula = j.empleado_id as string
            const jornadaId = j.id as string
            const tieneExtrasAprobadas = jornadaIdsAprobadas.has(jornadaId)

            for (const field of MINUTO_FIELDS) {
                const mins = (j[field] as number) ?? 0
                if (mins <= 0) continue

                const codigo = CODIGO_MAP[field]
                if (codigo <= 11004 && !tieneExtrasAprobadas) continue

                const key = `${cedula}::${codigo}`
                agg.set(key, (agg.get(key) ?? 0) + mins)
            }
        }

        for (const j of jornadas ?? []) {
            const cedula = j.empleado_id as string
            const mins = (j.minutos_domingos as number) ?? 0
            if (mins <= 0) continue
            const key = `${cedula}::11502`
            agg.set(key, (agg.get(key) ?? 0) + mins)
        }

        const lineas: LineaExtra[] = []
        for (const [key, totalMinutos] of agg) {
            const [cedula, codigoStr] = key.split('::')
            const horas = Math.floor(totalMinutos / 60)
            const minutos = totalMinutos % 60
            lineas.push({
                cedula,
                codigo: parseInt(codigoStr),
                horas,
                minutos,
            })
        }

        lineas.sort((a, b) => a.cedula.localeCompare(b.cedula) || a.codigo - b.codigo)

        const periodo = { anio, mes, quincena }
        const buffer = generarPlanoExtras(lineas, periodo)

        const filename = `plano_extras_${anio}-${pad(mes)}_${quincena}Q.xlsx`
        return new NextResponse(buffer.buffer as ArrayBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        })
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error interno'
        console.error('[API /reportes/planos/extras]', err)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}

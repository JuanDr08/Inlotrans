import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { generarPlanoExtras, type LineaExtra } from '@/lib/excel/planos/extras'

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
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ error: 'Config error' }, { status: 500 })
        }
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

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
        const startDay = quincena === 1 ? 1 : 16
        const endDay = quincena === 1 ? 15 : lastDay

        // UTC range: Colombia is UTC-5, so start 00:00 COL = 05:00 UTC
        const startUTC = new Date(`${anio}-${pad(mes)}-${pad(startDay)}T05:00:00Z`)
        const endUTC = new Date(`${anio}-${pad(mes)}-${pad(endDay)}T05:00:00Z`)
        endUTC.setUTCDate(endUTC.getUTCDate() + 1)

        // Get jornadas that have approved extras in the period
        const { data: aprobaciones } = await supabase
            .from('aprobaciones_extras')
            .select('jornada_id')
            .eq('estado', 'APROBADA')

        const jornadaIdsAprobadas = new Set(
            (aprobaciones ?? []).map((a) => a.jornada_id),
        )

        const { data: jornadas, error } = await supabase
            .from('jornadas')
            .select(`
                id, empleado_id,
                minutos_extras_ordinarias, minutos_extras_nocturnas,
                minutos_extras_dominical_festivo, minutos_extras_nocturna_dominical_festivo,
                minutos_nocturnas, minutos_festivos, minutos_domingos,
                minutos_domingos_festivos_nocturnos
            `)
            .in('estado', ['CERRADO', 'CERRADO_MANUAL'])
            .gte('entrada', startUTC.toISOString())
            .lt('entrada', endUTC.toISOString())

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // Aggregate minutes by employee + code
        const agg = new Map<string, number>()

        for (const j of jornadas ?? []) {
            const r = j as Record<string, unknown>
            const cedula = r.empleado_id as string
            const jornadaId = r.id as string
            const tieneExtrasAprobadas = jornadaIdsAprobadas.has(jornadaId)

            for (const field of MINUTO_FIELDS) {
                const mins = (r[field] as number) ?? 0
                if (mins <= 0) continue

                // Extras (11001-11004) only if approved
                const codigo = CODIGO_MAP[field]
                if (codigo <= 11004 && !tieneExtrasAprobadas) continue

                // Recargos (11501+) always included (they're not extras)
                // But minutos_domingos maps to 11502 too — merge with minutos_festivos
                const key = `${cedula}::${codigo}`
                agg.set(key, (agg.get(key) ?? 0) + mins)
            }
        }

        // Also add minutos_domingos to 11502 (RECARGO FESTIVO DIURNO)
        for (const j of jornadas ?? []) {
            const r = j as Record<string, unknown>
            const cedula = r.empleado_id as string
            const mins = (r.minutos_domingos as number) ?? 0
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
        const buffer = await generarPlanoExtras(lineas, periodo)

        const filename = `plano_extras_${anio}-${pad(mes)}_${quincena}Q.xlsx`
        return new NextResponse(new Uint8Array(buffer), {
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

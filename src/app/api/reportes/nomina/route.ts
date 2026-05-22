import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { toColombiaTime } from '@/lib/calculoHoras'
import { generarExcelNomina, type LineaNomina, type TarifaConCodigo } from '@/lib/excel/nomina'

function minToHalfHours(min: number): number {
    return Math.floor(min / 30) / 2
}

export const dynamic = 'force-dynamic'

// ════════════════════════════════════════════════════════════════════
// Helpers de fecha
// ════════════════════════════════════════════════════════════════════

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function fechaColombiaLarga(fechaUTC: Date): string {
    const col = toColombiaTime(fechaUTC)
    const dia = DIAS_SEMANA[col.getUTCDay()]
    const mes = MESES[col.getUTCMonth()]
    const d = String(col.getUTCDate()).padStart(2, '0')
    const y = col.getUTCFullYear()
    return `${dia}, ${mes} ${d}, ${y}`
}

function fechaColombiaDia(fechaUTC: Date): string {
    const col = toColombiaTime(fechaUTC)
    return `${col.getUTCFullYear()}-${String(col.getUTCMonth() + 1).padStart(2, '0')}-${String(col.getUTCDate()).padStart(2, '0')}`
}

function horaEnteraColombia(fechaUTC: Date): number {
    const col = toColombiaTime(fechaUTC)
    return col.getUTCHours()
}

// ════════════════════════════════════════════════════════════════════
// GET /api/reportes/nomina?start=YYYY-MM-DD&end=YYYY-MM-DD&op=OP1,OP2
// ════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
    try {
        // Auth
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ error: 'Config error' }, { status: 500 })
        }
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // Query params
        const { searchParams } = new URL(request.url)
        const startParam = searchParams.get('start')
        const endParam = searchParams.get('end')
        const opParam = searchParams.get('op')

        if (!startParam || !endParam) {
            return NextResponse.json({ error: 'Faltan parámetros start y end.' }, { status: 400 })
        }

        // Convertir rango a UTC: start 00:00 Colombia = 05:00 UTC, end 23:59 Colombia = +1 day 04:59 UTC
        const startUTC = new Date(`${startParam}T05:00:00Z`)
        const endUTC = new Date(`${endParam}T05:00:00Z`)
        endUTC.setUTCDate(endUTC.getUTCDate() + 1)

        const operaciones = opParam ? opParam.split(',').filter(Boolean) : []

        // ─── 1. Jornadas + usuarios (sin join a operaciones — no hay FK) ──
        let jornadaQuery = supabase
            .from('jornadas')
            .select(`
                id, empleado_id, operacion, entrada, salida,
                minutos_total, minutos_normales, minutos_nocturnas,
                minutos_extras_ordinarias, minutos_extras_nocturnas,
                minutos_extras_dominical_festivo, minutos_extras_nocturna_dominical_festivo,
                minutos_domingos, minutos_festivos, minutos_domingos_festivos_nocturnos,
                minutos_almuerzo_descontados,
                usuarios!inner ( id, nombre, cargo )
            `)
            .in('estado', ['CERRADO', 'CERRADO_MANUAL'])
            .gte('entrada', startUTC.toISOString())
            .lt('entrada', endUTC.toISOString())
            .order('entrada', { ascending: true })

        if (operaciones.length > 0) {
            jornadaQuery = jornadaQuery.in('operacion', operaciones)
        }

        const { data: jornadas, error: errJornadas } = await jornadaQuery
        if (errJornadas) {
            return NextResponse.json({ error: errJornadas.message }, { status: 500 })
        }

        // Lookup de operaciones por nombre → codigo (jornadas.operacion es TEXT, no FK)
        const { data: opsData } = await supabase.from('operaciones').select('nombre, codigo')
        const opCodigoMap = new Map<string, string>()
        for (const op of opsData ?? []) opCodigoMap.set(op.nombre, op.codigo)

        // ─── 2. Novedades en el rango ───────────────────────────
        const { data: novedades } = await supabase
            .from('novedades')
            .select('usuario_id, tipo_novedad, descripcion, fecha_novedad, fecha_inicio, fecha_fin')
            .or(
                `and(fecha_novedad.gte.${startParam},fecha_novedad.lte.${endParam}),and(fecha_inicio.lte.${endParam},fecha_fin.gte.${startParam})`,
            )

        // Index novedades por (usuario_id + fecha) para lookup rápido
        type NovedadLookup = { tipo: string; detalle: string }
        const novedadIndex = new Map<string, NovedadLookup[]>()

        for (const n of novedades ?? []) {
            const addForDate = (fecha: string) => {
                const key = `${n.usuario_id}::${fecha}`
                if (!novedadIndex.has(key)) novedadIndex.set(key, [])
                novedadIndex.get(key)!.push({
                    tipo: n.tipo_novedad,
                    detalle: n.descripcion ?? '',
                })
            }

            if (n.fecha_inicio && n.fecha_fin) {
                const ini = new Date(n.fecha_inicio)
                const fin = new Date(n.fecha_fin)
                const d = new Date(ini)
                while (d <= fin) {
                    const iso = d.toISOString().slice(0, 10)
                    if (iso >= startParam && iso <= endParam) addForDate(iso)
                    d.setDate(d.getDate() + 1)
                }
            } else if (n.fecha_novedad) {
                addForDate(n.fecha_novedad)
            }
        }

        // ─── 3. Tarifas con código de nómina ────────────────────
        const { data: tarifas } = await supabase
            .from('tarifas')
            .select('tipo_hora, precio_por_hora, codigo_nomina')
            .eq('activo', true)

        const tarifasConCodigo: TarifaConCodigo[] = (tarifas ?? []).map((t) => ({
            tipo_hora: t.tipo_hora,
            precio_por_hora: parseFloat(t.precio_por_hora),
            codigo_nomina: t.codigo_nomina,
        }))

        // ─── 4. Armar líneas ────────────────────────────────────
        const lineas: LineaNomina[] = []
        const empleadosConJornada = new Set<string>()

        for (const j of jornadas ?? []) {
            const r = j as Record<string, unknown>
            const usuario = r.usuarios as { id: string; nombre: string; cargo: string } | null

            if (!usuario) continue

            const opNombre = r.operacion as string
            const opCodigo = opCodigoMap.get(opNombre) ?? ''

            const entradaDate = new Date(r.entrada as string)
            const salidaDate = r.salida ? new Date(r.salida as string) : null
            const fechaDia = fechaColombiaDia(entradaDate)
            const horaIn = horaEnteraColombia(entradaDate)
            const horaOut = salidaDate ? horaEnteraColombia(salidaDate) : 0
            const horas = horaOut >= horaIn ? horaOut - horaIn : (24 - horaIn) + horaOut

            empleadosConJornada.add(`${usuario.id}::${fechaDia}`)

            const base: Omit<LineaNomina, 'novedad' | 'detalleNovedad'> = {
                fecha: fechaColombiaLarga(entradaDate),
                cargo: usuario.cargo ?? '',
                cedula: usuario.id,
                nombre: usuario.nombre,
                horaIn,
                horaOut,
                almuerzo: minToHalfHours(r.minutos_almuerzo_descontados as number),
                horas,
                extraDiurna: minToHalfHours(r.minutos_extras_ordinarias as number),
                extraNocturna: minToHalfHours(r.minutos_extras_nocturnas as number),
                extraFestivaDiurna: minToHalfHours(r.minutos_extras_dominical_festivo as number),
                extraFestivaNocturna: minToHalfHours(r.minutos_extras_nocturna_dominical_festivo as number),
                recargoNocturno: minToHalfHours(r.minutos_nocturnas as number),
                recargoFestivoNocturno: minToHalfHours(r.minutos_domingos_festivos_nocturnos as number),
                recargoFestivo: minToHalfHours((r.minutos_festivos as number) + (r.minutos_domingos as number)),
                operacion: opNombre,
                codigoOperacion: opCodigo,
                detalleOperacion: '',
            }

            const novedadesDelDia = novedadIndex.get(`${usuario.id}::${fechaDia}`)

            if (novedadesDelDia && novedadesDelDia.length > 0) {
                for (const nov of novedadesDelDia) {
                    lineas.push({ ...base, novedad: nov.tipo, detalleNovedad: nov.detalle })
                }
            } else {
                lineas.push({ ...base, novedad: '', detalleNovedad: '' })
            }
        }

        // ─── 5. Días con novedad pero sin jornada ───────────────
        for (const [key, novs] of novedadIndex) {
            if (empleadosConJornada.has(key)) continue

            const [cedula, fecha] = key.split('::')
            const { data: usuario } = await supabase
                .from('usuarios')
                .select('id, nombre, cargo, operacion')
                .eq('id', cedula)
                .maybeSingle()

            if (!usuario) continue

            let opCodigo = ''
            if (usuario.operacion) {
                const { data: op } = await supabase
                    .from('operaciones')
                    .select('codigo')
                    .eq('nombre', usuario.operacion)
                    .maybeSingle()
                opCodigo = op?.codigo ?? ''
            }

            const [y, m, d] = fecha.split('-').map(Number)
            const fakeDateParts = `${DIAS_SEMANA[new Date(y, m - 1, d).getDay()]}, ${MESES[m - 1]} ${String(d).padStart(2, '0')}, ${y}`

            for (const nov of novs) {
                lineas.push({
                    fecha: fakeDateParts,
                    cargo: usuario.cargo ?? '',
                    cedula: usuario.id,
                    nombre: usuario.nombre,
                    horaIn: 0,
                    horaOut: 0,
                    almuerzo: 0,
                    horas: 0,
                    extraDiurna: 0,
                    extraNocturna: 0,
                    extraFestivaDiurna: 0,
                    extraFestivaNocturna: 0,
                    recargoNocturno: 0,
                    recargoFestivoNocturno: 0,
                    recargoFestivo: 0,
                    operacion: usuario.operacion ?? '',
                    codigoOperacion: opCodigo,
                    detalleOperacion: '',
                    novedad: nov.tipo,
                    detalleNovedad: nov.detalle,
                })
            }
        }

        // Ordenar por fecha y nombre
        lineas.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.nombre.localeCompare(b.nombre))

        // ─── 6. Generar Excel ───────────────────────────────────
        const buffer = await generarExcelNomina(lineas, tarifasConCodigo)

        const filename = `nomina_${startParam}_${endParam}.xlsx`
        return new NextResponse(new Uint8Array(buffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        })
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error interno'
        console.error('[API /reportes/nomina]', err)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}

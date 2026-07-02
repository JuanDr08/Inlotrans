import { NextRequest, NextResponse } from 'next/server'
import { toColombiaTime } from '@/lib/calculoHoras'
import { generarExcelNomina, type LineaNomina, type TarifaConCodigo } from '@/lib/excel/nomina'
import { getD1 } from '@/lib/d1/client'

function minToRoundedHours(min: number): number {
    if (min <= 0) return 0
    const remainder = min % 60
    const base = Math.floor(min / 60)
    return remainder >= 30 ? base + 1 : base
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
        const db = getD1()

        const { searchParams } = new URL(request.url)
        const startParam = searchParams.get('start')
        const endParam = searchParams.get('end')
        const opParam = searchParams.get('op')

        if (!startParam || !endParam) {
            return NextResponse.json({ error: 'Faltan parámetros start y end.' }, { status: 400 })
        }

        const startUTC = new Date(`${startParam}T05:00:00Z`)
        const endUTC = new Date(`${endParam}T05:00:00Z`)
        endUTC.setUTCDate(endUTC.getUTCDate() + 1)

        const operaciones = opParam ? opParam.split(',').filter(Boolean) : []

        // ─── 1. Jornadas + usuarios ──────────────────────────────
        let jornadaSql = `
            SELECT j.id, j.empleado_id, j.operacion, j.entrada, j.salida,
                   j.minutos_total, j.minutos_normales, j.minutos_nocturnas,
                   j.minutos_extras_ordinarias, j.minutos_extras_nocturnas,
                   j.minutos_extras_dominical_festivo, j.minutos_extras_nocturna_dominical_festivo,
                   j.minutos_domingos, j.minutos_festivos, j.minutos_domingos_festivos_nocturnos,
                   j.minutos_almuerzo_descontados,
                   u.id AS usuario_id_join, u.nombre AS usuario_nombre, u.cargo AS usuario_cargo
            FROM jornadas j
            INNER JOIN usuarios u ON u.id = j.empleado_id
            WHERE j.estado IN ('CERRADO', 'CERRADO_MANUAL')
            AND j.entrada >= ? AND j.entrada < ?`

        const bindValues: unknown[] = [startUTC.toISOString(), endUTC.toISOString()]

        if (operaciones.length > 0) {
            const placeholders = operaciones.map(() => '?').join(', ')
            jornadaSql += ` AND j.operacion IN (${placeholders})`
            bindValues.push(...operaciones)
        }

        jornadaSql += ' ORDER BY j.entrada ASC'

        const { results: jornadas } = await db.prepare(jornadaSql).bind(...bindValues).all()

        const { results: opsData } = await db.prepare('SELECT nombre, codigo FROM operaciones').all()
        const opCodigoMap = new Map<string, string>()
        for (const op of opsData ?? []) opCodigoMap.set(op.nombre as string, op.codigo as string)

        // ─── 2. Novedades en el rango ───────────────────────────
        const { results: novedades } = await db
            .prepare(
                `SELECT usuario_id, tipo_novedad, descripcion, fecha_novedad, fecha_inicio, fecha_fin
                 FROM novedades
                 WHERE (fecha_novedad >= ? AND fecha_novedad <= ?)
                    OR (fecha_inicio <= ? AND fecha_fin >= ?)`,
            )
            .bind(startParam, endParam, endParam, startParam)
            .all()

        type NovedadLookup = { tipo: string; detalle: string }
        const novedadIndex = new Map<string, NovedadLookup[]>()

        for (const n of novedades ?? []) {
            const addForDate = (fecha: string) => {
                const key = `${n.usuario_id}::${fecha}`
                if (!novedadIndex.has(key)) novedadIndex.set(key, [])
                novedadIndex.get(key)!.push({
                    tipo: n.tipo_novedad as string,
                    detalle: (n.descripcion as string) ?? '',
                })
            }

            if (n.fecha_inicio && n.fecha_fin) {
                const ini = new Date(n.fecha_inicio as string)
                const fin = new Date(n.fecha_fin as string)
                const d = new Date(ini)
                while (d <= fin) {
                    const iso = d.toISOString().slice(0, 10)
                    if (iso >= startParam && iso <= endParam) addForDate(iso)
                    d.setDate(d.getDate() + 1)
                }
            } else if (n.fecha_novedad) {
                addForDate(n.fecha_novedad as string)
            }
        }

        // ─── 3. Tarifas con código de nómina ────────────────────
        const { results: tarifas } = await db
            .prepare("SELECT tipo_hora, precio_por_hora, codigo_nomina FROM tarifas WHERE activo = 1")
            .all()

        const tarifasConCodigo: TarifaConCodigo[] = ((tarifas ?? []) as Record<string, unknown>[]).map((t: Record<string, unknown>) => ({
            tipo_hora: t.tipo_hora as string,
            precio_por_hora: parseFloat(t.precio_por_hora as string),
            codigo_nomina: t.codigo_nomina as string,
        }))

        // ─── 4. Armar líneas ────────────────────────────────────
        const lineas: LineaNomina[] = []
        const empleadosConJornada = new Set<string>()

        for (const j of jornadas ?? []) {
            const cedula = j.usuario_id_join as string
            if (!cedula) continue

            const opNombre = j.operacion as string
            const opCodigo = opCodigoMap.get(opNombre) ?? ''

            const entradaDate = new Date(j.entrada as string)
            const salidaDate = j.salida ? new Date(j.salida as string) : null
            const fechaDia = fechaColombiaDia(entradaDate)
            const horaIn = horaEnteraColombia(entradaDate)
            const horaOut = salidaDate ? horaEnteraColombia(salidaDate) : 0
            const horas = horaOut >= horaIn ? horaOut - horaIn : (24 - horaIn) + horaOut

            empleadosConJornada.add(`${cedula}::${fechaDia}`)

            const base: Omit<LineaNomina, 'novedad' | 'detalleNovedad'> = {
                fecha: fechaColombiaLarga(entradaDate),
                cargo: (j.usuario_cargo as string) ?? '',
                cedula,
                nombre: j.usuario_nombre as string,
                horaIn,
                horaOut,
                almuerzo: minToRoundedHours(j.minutos_almuerzo_descontados as number),
                horas,
                extraDiurna: minToRoundedHours(j.minutos_extras_ordinarias as number),
                extraNocturna: minToRoundedHours(j.minutos_extras_nocturnas as number),
                extraFestivaDiurna: minToRoundedHours(j.minutos_extras_dominical_festivo as number),
                extraFestivaNocturna: minToRoundedHours(j.minutos_extras_nocturna_dominical_festivo as number),
                recargoNocturno: minToRoundedHours(j.minutos_nocturnas as number),
                recargoFestivoNocturno: minToRoundedHours(j.minutos_domingos_festivos_nocturnos as number),
                recargoFestivo: minToRoundedHours((j.minutos_festivos as number) + (j.minutos_domingos as number)),
                operacion: opNombre,
                codigoOperacion: opCodigo,
                detalleOperacion: '',
            }

            const novedadesDelDia = novedadIndex.get(`${cedula}::${fechaDia}`)

            if (novedadesDelDia && novedadesDelDia.length > 0) {
                for (const nov of novedadesDelDia) {
                    lineas.push({ ...base, novedad: nov.tipo, detalleNovedad: nov.detalle })
                }
            } else {
                lineas.push({ ...base, novedad: '', detalleNovedad: '' })
            }
        }

        // ─── 5. Días con novedad pero sin jornada ───────────────
        const cedulasSinJornada = new Set<string>()
        for (const key of novedadIndex.keys()) {
            if (!empleadosConJornada.has(key)) cedulasSinJornada.add(key.split('::')[0])
        }

        const usuarioCache = new Map<string, Record<string, unknown>>()
        if (cedulasSinJornada.size > 0) {
            const placeholders = [...cedulasSinJornada].map(() => '?').join(', ')
            const { results: usuarios } = await db
                .prepare(`SELECT id, nombre, cargo, operacion FROM usuarios WHERE id IN (${placeholders})`)
                .bind(...cedulasSinJornada)
                .all()
            for (const u of usuarios ?? []) usuarioCache.set(u.id as string, u)
        }

        for (const [key, novs] of novedadIndex) {
            if (empleadosConJornada.has(key)) continue

            const [cedula, fecha] = key.split('::')
            const usuario = usuarioCache.get(cedula)

            if (!usuario) continue

            const opCodigo = opCodigoMap.get(usuario.operacion as string) ?? ''

            const [y, m, d] = fecha.split('-').map(Number)
            const fakeDateParts = `${DIAS_SEMANA[new Date(y, m - 1, d).getDay()]}, ${MESES[m - 1]} ${String(d).padStart(2, '0')}, ${y}`

            for (const nov of novs) {
                lineas.push({
                    fecha: fakeDateParts,
                    cargo: (usuario.cargo as string) ?? '',
                    cedula: usuario.id as string,
                    nombre: usuario.nombre as string,
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
                    operacion: (usuario.operacion as string) ?? '',
                    codigoOperacion: opCodigo,
                    detalleOperacion: '',
                    novedad: nov.tipo,
                    detalleNovedad: nov.detalle,
                })
            }
        }

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

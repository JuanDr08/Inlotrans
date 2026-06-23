import { NextRequest, NextResponse } from 'next/server'
import { toColombiaTime } from '@/lib/calculoHoras'
import { getD1, generateId } from '@/lib/d1/client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const UMBRAL_INCONSISTENTE_HORAS = 16
const MINUTOS_SEMANA_PACTADOS = 44 * 60 // 2640

export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization')
        if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const db = getD1()
        const ahora = new Date()
        const umbralISO = new Date(ahora.getTime() - UMBRAL_INCONSISTENTE_HORAS * 60 * 60 * 1000).toISOString()

        // ─── 1. Detectar y marcar jornadas INCONSISTENTES (batch) ──
        const { results: jornadasAbiertas } = await db
            .prepare(
                `SELECT id, empleado_id, operacion FROM jornadas
                 WHERE estado = 'ABIERTO' AND entrada < ?`,
            )
            .bind(umbralISO)
            .all()

        const inconsistentes: string[] = []

        if (jornadasAbiertas && jornadasAbiertas.length > 0) {
            const stmts = []
            for (const j of jornadasAbiertas) {
                const jId = j.id as string
                inconsistentes.push(jId)

                stmts.push(
                    db.prepare("UPDATE jornadas SET estado = 'INCONSISTENTE' WHERE id = ?")
                        .bind(jId),
                )
                stmts.push(
                    db.prepare(
                        "INSERT INTO alertas (id, tipo, empleado_id, jornada_id, operacion, mensaje) VALUES (?, ?, ?, ?, ?, ?)",
                    ).bind(
                        generateId(),
                        'INCONSISTENTE',
                        j.empleado_id,
                        jId,
                        j.operacion,
                        `Jornada abierta por más de ${UMBRAL_INCONSISTENTE_HORAS}h sin salida registrada.`,
                    ),
                )
            }
            await db.batch(stmts)
        }

        // ─── 2. Cierre dominical (si ayer fue domingo en Colombia) ─
        const ahoraBogota = toColombiaTime(ahora)
        const ayerBogota = new Date(ahoraBogota.getTime() - 24 * 60 * 60 * 1000)
        const ayerFueDomingo = ayerBogota.getUTCDay() === 0
        let resumenDominical: {
            semana_inicio: string
            semana_fin: string
            empleados_procesados: number
        } | null = null

        if (ayerFueDomingo) {
            const domingo = new Date(ayerBogota)
            domingo.setUTCHours(0, 0, 0, 0)
            const lunes = new Date(domingo)
            lunes.setUTCDate(lunes.getUTCDate() - 6)

            const semanaInicio = lunes.toISOString().slice(0, 10)
            const semanaFin = domingo.toISOString().slice(0, 10)

            const inicioUTC = new Date(lunes.getTime() + 5 * 60 * 60 * 1000)
            const finUTC = new Date(
                domingo.getTime() + 24 * 60 * 60 * 1000 + 5 * 60 * 60 * 1000,
            )

            // Aggregated query: sum ordinary minutes per employee in one shot
            interface MinutosAgregados { empleado_id: string; total_ordinarios: number }
            const { results: minutosAgg } = await db
                .prepare(
                    `SELECT empleado_id,
                            SUM(COALESCE(minutos_normales, 0) + COALESCE(minutos_nocturnas, 0) +
                                COALESCE(minutos_domingos, 0) + COALESCE(minutos_festivos, 0) +
                                COALESCE(minutos_domingos_festivos_nocturnos, 0)) as total_ordinarios
                     FROM jornadas
                     WHERE estado IN ('CERRADO', 'CERRADO_MANUAL')
                       AND entrada >= ? AND entrada < ?
                     GROUP BY empleado_id`,
                )
                .bind(inicioUTC.toISOString(), finUTC.toISOString())
                .all()

            const minutosMap = new Map<string, number>()
            for (const row of (minutosAgg ?? []) as unknown as MinutosAgregados[]) {
                minutosMap.set(row.empleado_id, row.total_ordinarios)
            }

            // Aggregated query: paid novedades that intersect the week
            interface NovedadRow {
                usuario_id: string
                fecha_novedad: string | null
                fecha_inicio: string | null
                fecha_fin: string | null
            }
            const { results: novedadesRaw } = await db
                .prepare(
                    `SELECT usuario_id, fecha_novedad, fecha_inicio, fecha_fin
                     FROM novedades
                     WHERE es_pagado = 1
                       AND ((fecha_novedad >= ? AND fecha_novedad <= ?)
                            OR (fecha_inicio <= ? AND fecha_fin >= ?))`,
                )
                .bind(semanaInicio, semanaFin, semanaFin, semanaInicio)
                .all()

            const novedadesMap = new Map<string, number>()
            for (const nov of (novedadesRaw ?? []) as unknown as NovedadRow[]) {
                let minutosNov = 0
                if (nov.fecha_inicio && nov.fecha_fin) {
                    const ini = new Date(
                        Math.max(new Date(nov.fecha_inicio).getTime(), lunes.getTime()),
                    )
                    const fin = new Date(
                        Math.min(new Date(nov.fecha_fin).getTime(), domingo.getTime()),
                    )
                    if (fin.getTime() >= ini.getTime()) {
                        const dias = Math.floor((fin.getTime() - ini.getTime()) / 86400000) + 1
                        minutosNov = Math.max(0, dias) * 480
                    }
                } else if (nov.fecha_novedad) {
                    const f = new Date(nov.fecha_novedad)
                    if (f.getTime() >= lunes.getTime() && f.getTime() <= domingo.getTime()) {
                        minutosNov = 480
                    }
                }

                if (minutosNov > 0) {
                    const prev = novedadesMap.get(nov.usuario_id) ?? 0
                    novedadesMap.set(nov.usuario_id, prev + minutosNov)
                }
            }

            // All active employees
            const { results: empleados } = await db
                .prepare("SELECT id FROM usuarios WHERE status = 'activo'")
                .all()

            // Build upsert batch
            const upsertStmts = []
            for (const emp of (empleados ?? []) as { id: string }[]) {
                const minutosOrdinarios = minutosMap.get(emp.id) ?? 0
                const minutosNovedades = novedadesMap.get(emp.id) ?? 0
                const pagaDomingo = minutosOrdinarios + minutosNovedades >= MINUTOS_SEMANA_PACTADOS

                upsertStmts.push(
                    db.prepare(
                        `INSERT INTO semanas_dominicales (id, empleado_id, semana_inicio, semana_fin, minutos_ordinarios, minutos_novedades_remuneradas, paga_domingo, marcado_por)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                         ON CONFLICT(empleado_id, semana_inicio) DO UPDATE SET
                         semana_fin = excluded.semana_fin,
                         minutos_ordinarios = excluded.minutos_ordinarios,
                         minutos_novedades_remuneradas = excluded.minutos_novedades_remuneradas,
                         paga_domingo = excluded.paga_domingo,
                         marcado_por = excluded.marcado_por`,
                    ).bind(
                        generateId(),
                        emp.id,
                        semanaInicio,
                        semanaFin,
                        minutosOrdinarios,
                        minutosNovedades,
                        pagaDomingo ? 1 : 0,
                        'sistema',
                    ),
                )
            }

            if (upsertStmts.length > 0) {
                await db.batch(upsertStmts)
            }

            resumenDominical = {
                semana_inicio: semanaInicio,
                semana_fin: semanaFin,
                empleados_procesados: empleados?.length ?? 0,
            }
        }

        console.log(
            `[CRON ${ahora.toISOString()}] inconsistentes=${inconsistentes.length} dominical=${ayerFueDomingo ? 'sí' : 'no'}`,
        )

        return NextResponse.json({
            success: true,
            timestamp: ahora.toISOString(),
            inconsistentes_marcadas: inconsistentes.length,
            ids_inconsistentes: inconsistentes,
            cierre_dominical: resumenDominical,
        })
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error'
        console.error('[CRON] Error:', msg)
        return NextResponse.json({ success: false, error: msg }, { status: 500 })
    }
}

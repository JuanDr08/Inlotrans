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

        // ─── 1. Detectar jornadas INCONSISTENTES ─────────────────
        const umbralMs = UMBRAL_INCONSISTENTE_HORAS * 60 * 60 * 1000

        const { results: jornadasAbiertas } = await db
            .prepare("SELECT id, empleado_id, operacion, entrada FROM jornadas WHERE estado = 'ABIERTO'")
            .all()

        const inconsistentes: string[] = []

        for (const j of jornadasAbiertas ?? []) {
            const transcurridoMs = ahora.getTime() - new Date(j.entrada as string).getTime()
            if (transcurridoMs < umbralMs) continue

            await db
                .prepare("UPDATE jornadas SET estado = 'INCONSISTENTE' WHERE id = ?")
                .bind(j.id)
                .run()

            await db
                .prepare("INSERT INTO alertas (id, tipo, empleado_id, jornada_id, operacion, mensaje) VALUES (?, ?, ?, ?, ?, ?)")
                .bind(
                    generateId(),
                    'INCONSISTENTE',
                    j.empleado_id,
                    j.id,
                    j.operacion,
                    `Jornada abierta por más de ${UMBRAL_INCONSISTENTE_HORAS}h sin salida registrada.`,
                )
                .run()

            inconsistentes.push(j.id as string)
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

            const { results: empleados } = await db
                .prepare("SELECT id FROM usuarios WHERE status = 'activo'")
                .all()

            let procesados = 0

            for (const emp of empleados ?? []) {
                const { results: jornadasSemana } = await db
                    .prepare(
                        `SELECT minutos_normales, minutos_nocturnas, minutos_domingos, minutos_festivos, minutos_domingos_festivos_nocturnos
                         FROM jornadas
                         WHERE empleado_id = ? AND estado IN ('CERRADO', 'CERRADO_MANUAL')
                         AND entrada >= ? AND entrada < ?`,
                    )
                    .bind(emp.id, inicioUTC.toISOString(), finUTC.toISOString())
                    .all()

                const rows = (jornadasSemana ?? []) as Record<string, number>[]
                const minutosOrdinarios = rows.reduce(
                    (acc: number, j: Record<string, number>) =>
                        acc +
                        (j.minutos_normales ?? 0) +
                        (j.minutos_nocturnas ?? 0) +
                        (j.minutos_domingos ?? 0) +
                        (j.minutos_festivos ?? 0) +
                        (j.minutos_domingos_festivos_nocturnos ?? 0),
                    0,
                )

                const { results: novedades } = await db
                    .prepare(
                        "SELECT fecha_novedad, fecha_inicio, fecha_fin FROM novedades WHERE usuario_id = ? AND es_pagado = 1",
                    )
                    .bind(emp.id)
                    .all()

                let minutosNovedades = 0
                for (const nov of novedades ?? []) {
                    if (nov.fecha_inicio && nov.fecha_fin) {
                        const ini = new Date(
                            Math.max(
                                new Date(nov.fecha_inicio as string).getTime(),
                                lunes.getTime(),
                            ),
                        )
                        const fin = new Date(
                            Math.min(
                                new Date(nov.fecha_fin as string).getTime(),
                                domingo.getTime(),
                            ),
                        )
                        if (fin.getTime() >= ini.getTime()) {
                            const dias =
                                Math.floor((fin.getTime() - ini.getTime()) / 86400000) + 1
                            minutosNovedades += Math.max(0, dias) * 480
                        }
                    } else if (nov.fecha_novedad) {
                        const f = new Date(nov.fecha_novedad as string)
                        if (f.getTime() >= lunes.getTime() && f.getTime() <= domingo.getTime()) {
                            minutosNovedades += 480
                        }
                    }
                }

                const pagaDomingo =
                    minutosOrdinarios + minutosNovedades >= MINUTOS_SEMANA_PACTADOS

                await db
                    .prepare(
                        `INSERT INTO semanas_dominicales (id, empleado_id, semana_inicio, semana_fin, minutos_ordinarios, minutos_novedades_remuneradas, paga_domingo, marcado_por)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                         ON CONFLICT(empleado_id, semana_inicio) DO UPDATE SET
                         semana_fin = excluded.semana_fin,
                         minutos_ordinarios = excluded.minutos_ordinarios,
                         minutos_novedades_remuneradas = excluded.minutos_novedades_remuneradas,
                         paga_domingo = excluded.paga_domingo,
                         marcado_por = excluded.marcado_por`,
                    )
                    .bind(
                        generateId(),
                        emp.id,
                        semanaInicio,
                        semanaFin,
                        minutosOrdinarios,
                        minutosNovedades,
                        pagaDomingo ? 1 : 0,
                        'sistema',
                    )
                    .run()

                procesados++
            }

            resumenDominical = {
                semana_inicio: semanaInicio,
                semana_fin: semanaFin,
                empleados_procesados: procesados,
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

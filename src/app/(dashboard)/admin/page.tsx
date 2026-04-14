import { createClient } from '@/lib/supabase/server'
import { calcularHorasTodosUsuariosPorPeriodoOptimizado } from '@/lib/calculoHoras'
import { AdminFilters } from './AdminFilters'
import { AdminExcelButton } from './AdminExcelButton'
import { AdminTablesClient } from './AdminTablesClient'
import { Suspense } from 'react'
import { getUserProfile } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function AdminPage({
    searchParams,
}: {
    searchParams: Promise<{ start?: string; end?: string; op?: string; mes?: string; anio?: string; periodo?: string }>
}) {
    const profile = await getUserProfile()
    if (!profile) redirect('/')

    const pParams = await searchParams

    let grupos: { nombre: string, start: Date, end: Date }[] = []

    if (pParams.periodo === 'personalizado' && pParams.start && pParams.end) {
        grupos.push({ nombre: 'Período Personalizado', start: new Date(pParams.start), end: new Date(pParams.end) })
    } else {
        const mes = pParams.mes ? parseInt(pParams.mes) : new Date().getMonth()
        const anio = pParams.anio ? parseInt(pParams.anio) : new Date().getFullYear()

        if (pParams.periodo === 'quincenal' || !pParams.periodo) {
            grupos.push({ nombre: 'Primera Quincena', start: new Date(anio, mes, 1), end: new Date(anio, mes, 15, 23, 59, 59, 999) })
            grupos.push({ nombre: 'Segunda Quincena', start: new Date(anio, mes, 16), end: new Date(anio, mes + 1, 0, 23, 59, 59, 999) })
        } else if (pParams.periodo === 'mensual') {
            grupos.push({ nombre: `Mes Completo`, start: new Date(anio, mes, 1), end: new Date(anio, mes + 1, 0, 23, 59, 59, 999) })
        } else if (pParams.periodo === 'semanal') {
            grupos.push({ nombre: 'Semana 1', start: new Date(anio, mes, 1), end: new Date(anio, mes, 7, 23, 59, 59, 999) })
            grupos.push({ nombre: 'Semana 2', start: new Date(anio, mes, 8), end: new Date(anio, mes, 14, 23, 59, 59, 999) })
            grupos.push({ nombre: 'Semana 3', start: new Date(anio, mes, 15), end: new Date(anio, mes, 21, 23, 59, 59, 999) })
            grupos.push({ nombre: 'Semana 4', start: new Date(anio, mes, 22), end: new Date(anio, mes + 1, 0, 23, 59, 59, 999) })
        }
    }

    const operaciones = profile.rol === 'coordinador'
        ? [profile.operacion_nombre!]
        : (pParams.op ? pParams.op.split(',') : [])

    const gruposConDatos = await Promise.all(grupos.map(async (g) => {
        const rawDatos = await calcularHorasTodosUsuariosPorPeriodoOptimizado(g.start, g.end, operaciones)
        // Strip the registros array (detailed per-pair calculations) — not needed for the table view
        const datos = rawDatos.map((d: any) => {
            const { registros, ...rest } = d;
            return rest;
        });
        return { 
            nombre: g.nombre, 
            startString: g.start.toLocaleDateString('es-CO'), 
            endString: g.end.toLocaleDateString('es-CO'), 
            datos 
        }
    }))

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Reporte Administrativo</h1>
                    <p className="text-muted-foreground mt-1">Liquidación precisa del período seleccionado</p>
                </div>
                <div>
                    <Suspense fallback={<div className="h-9 w-32 animate-pulse bg-slate-200 rounded-md" />}>
                        <AdminExcelButton />
                    </Suspense>
                </div>
            </div>

            <Suspense fallback={<div className="h-9 w-full animate-pulse bg-slate-200 rounded-md mb-6" />}>
                <AdminFilters rol={profile.rol} operacionFija={profile.operacion_nombre} />
            </Suspense>

            <AdminTablesClient grupos={gruposConDatos} />
        </div>
    )
}

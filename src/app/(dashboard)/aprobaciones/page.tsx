import { getAprobacionesPendientes, getJornadasInconsistentes, getAprobacionesResueltas } from './actions'
import { AprobacionesPanel, InconsistentesPanel, ResueltasPanel } from './AprobacionesClient'
import { Clock, AlertTriangle, History } from 'lucide-react'
import { Pagination } from '@/components/Pagination'

const PAGE_SIZE = 10

export default async function AprobacionesPage({
    searchParams,
}: {
    searchParams: Promise<{ pageAp?: string; pageInc?: string; pageRes?: string }>
}) {
    const pParams = await searchParams
    const pageAp = Math.max(1, parseInt(pParams.pageAp ?? '1', 10) || 1)
    const pageInc = Math.max(1, parseInt(pParams.pageInc ?? '1', 10) || 1)
    const pageRes = Math.max(1, parseInt(pParams.pageRes ?? '1', 10) || 1)

    const [aprobacionesRes, inconsistentesRes, resueltasRes] = await Promise.all([
        getAprobacionesPendientes(PAGE_SIZE, (pageAp - 1) * PAGE_SIZE),
        getJornadasInconsistentes(PAGE_SIZE, (pageInc - 1) * PAGE_SIZE),
        getAprobacionesResueltas(PAGE_SIZE, (pageRes - 1) * PAGE_SIZE),
    ])

    const aprobaciones = aprobacionesRes.data ?? []
    const totalAp = aprobacionesRes.total ?? 0
    const inconsistentes = inconsistentesRes.data ?? []
    const totalInc = inconsistentesRes.total ?? 0
    const resueltas = resueltasRes.data ?? []
    const totalRes = resueltasRes.total ?? 0

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Panel de Control</h1>
                <p className="text-slate-500 text-sm">Aprobaciones de horas extra y corrección de jornadas inconsistentes.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Extras pendientes */}
                <section className="space-y-4">
                    <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-amber-500" />
                        <h2 className="text-lg font-semibold text-slate-700">
                            Horas Extra Pendientes
                            {totalAp > 0 && (
                                <span className="ml-2 text-sm font-normal text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                                    {totalAp}
                                </span>
                            )}
                        </h2>
                    </div>
                    <AprobacionesPanel aprobaciones={aprobaciones as any} />
                    <Pagination page={pageAp} pageSize={PAGE_SIZE} total={totalAp} paramName="pageAp" />
                </section>

                {/* Jornadas inconsistentes */}
                <section className="space-y-4">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                        <h2 className="text-lg font-semibold text-slate-700">
                            Jornadas Inconsistentes
                            {totalInc > 0 && (
                                <span className="ml-2 text-sm font-normal text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                                    {totalInc}
                                </span>
                            )}
                        </h2>
                    </div>
                    <InconsistentesPanel jornadas={inconsistentes as any} />
                    <Pagination page={pageInc} pageSize={PAGE_SIZE} total={totalInc} paramName="pageInc" />
                </section>
            </div>

            {/* Historial de resueltas */}
            <section className="space-y-4">
                <div className="flex items-center gap-2">
                    <History className="w-5 h-5 text-slate-500" />
                    <h2 className="text-lg font-semibold text-slate-700">
                        Historial de Extras Resueltas
                        {totalRes > 0 && (
                            <span className="ml-2 text-sm font-normal text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                                {totalRes}
                            </span>
                        )}
                    </h2>
                </div>
                <ResueltasPanel aprobaciones={resueltas as any} />
                <Pagination page={pageRes} pageSize={PAGE_SIZE} total={totalRes} paramName="pageRes" />
            </section>
        </div>
    )
}

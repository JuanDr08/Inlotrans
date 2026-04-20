import { getAprobacionesPendientes, getJornadasInconsistentes } from './actions'
import { AprobacionesPanel, InconsistentesPanel } from './AprobacionesClient'
import { Clock, AlertTriangle } from 'lucide-react'

export default async function AprobacionesPage() {
    const [aprobacionesRes, inconsistentesRes] = await Promise.all([
        getAprobacionesPendientes(),
        getJornadasInconsistentes(),
    ])

    const aprobaciones = aprobacionesRes.data ?? []
    const inconsistentes = inconsistentesRes.data ?? []

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
                            {aprobaciones.length > 0 && (
                                <span className="ml-2 text-sm font-normal text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                                    {aprobaciones.length}
                                </span>
                            )}
                        </h2>
                    </div>
                    <AprobacionesPanel aprobaciones={aprobaciones as any} />
                </section>

                {/* Jornadas inconsistentes */}
                <section className="space-y-4">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                        <h2 className="text-lg font-semibold text-slate-700">
                            Jornadas Inconsistentes
                            {inconsistentes.length > 0 && (
                                <span className="ml-2 text-sm font-normal text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                                    {inconsistentes.length}
                                </span>
                            )}
                        </h2>
                    </div>
                    <InconsistentesPanel jornadas={inconsistentes as any} />
                </section>
            </div>
        </div>
    )
}

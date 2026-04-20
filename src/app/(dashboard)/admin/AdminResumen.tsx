import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Clock, DollarSign, Briefcase } from 'lucide-react'

function fmtHoras(minutos: number): string {
    if (!minutos) return '0h'
    const h = Math.floor(minutos / 60)
    const m = minutos % 60
    return m > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${h}h`
}

function fmtCOP(n: number): string {
    return `$${Math.round(n).toLocaleString('es-CO')}`
}

export function AdminResumen({
    empleados,
    minutosTotales,
    valorTotal,
    operacionesFiltradas,
}: {
    empleados: number
    minutosTotales: number
    valorTotal: number
    operacionesFiltradas: number
}) {
    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi
                label="Empleados con jornadas"
                valor={String(empleados)}
                sub={empleados === 0 ? 'Sin datos en el período' : 'En el período filtrado'}
                Icon={Users}
                tone="slate"
            />
            <Kpi
                label="Horas liquidadas"
                valor={fmtHoras(minutosTotales)}
                sub={`${minutosTotales.toLocaleString('es-CO')} minutos efectivos`}
                Icon={Clock}
                tone="indigo"
            />
            <Kpi
                label="Valor total"
                valor={fmtCOP(valorTotal)}
                sub="Bruto (sin aprobar extras)"
                Icon={DollarSign}
                tone="emerald"
            />
            <Kpi
                label="Operaciones"
                valor={operacionesFiltradas === 0 ? 'Todas' : String(operacionesFiltradas)}
                sub={operacionesFiltradas === 0 ? 'Sin filtro aplicado' : 'Operación(es) seleccionada(s)'}
                Icon={Briefcase}
                tone="blue"
            />
        </div>
    )
}

const TONES = {
    slate: { bg: 'bg-slate-50', icon: 'text-slate-600' },
    indigo: { bg: 'bg-indigo-50', icon: 'text-indigo-600' },
    emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600' },
    blue: { bg: 'bg-blue-50', icon: 'text-blue-600' },
}

function Kpi({
    label,
    valor,
    sub,
    Icon,
    tone,
}: {
    label: string
    valor: string
    sub: string
    Icon: typeof Users
    tone: keyof typeof TONES
}) {
    const t = TONES[tone]
    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-2">
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg ${t.bg}`}>
                        <Icon className={`h-3.5 w-3.5 ${t.icon}`} />
                    </span>
                    {label}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-2xl font-bold text-slate-900 tabular-nums">{valor}</p>
                <p className="text-xs text-slate-500 mt-1">{sub}</p>
            </CardContent>
        </Card>
    )
}

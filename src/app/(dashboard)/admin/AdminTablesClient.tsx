'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { CalendarRange, Inbox } from 'lucide-react'
import type { ResumenEmpleadoPeriodo } from '@/lib/reportes'

interface Grupo {
    nombre: string
    startString: string
    endString: string
    datos: ResumenEmpleadoPeriodo[]
}

const BADGE_TIPOS: { key: string; label: string; cls: string }[] = [
    { key: 'extrasOrdinarias',               label: 'Extra',       cls: 'bg-emerald-100 text-emerald-700' },
    { key: 'nocturnas',                      label: 'Nocturno',    cls: 'bg-indigo-100 text-indigo-700' },
    { key: 'extrasNocturnas',                label: 'Ex Noct',     cls: 'bg-pink-100 text-pink-700' },
    { key: 'festivos',                       label: 'Festivo',     cls: 'bg-amber-100 text-amber-800' },
    { key: 'domingos',                       label: 'Domingo',     cls: 'bg-blue-100 text-blue-700' },
    { key: 'domingosFestivosNocturnos',      label: 'D/F Noct',    cls: 'bg-violet-100 text-violet-700' },
    { key: 'extrasDominicalFestivo',         label: 'Ex D/F',      cls: 'bg-orange-100 text-orange-700' },
    { key: 'extrasNocturnaDominicalFestivo', label: 'Ex D/F Noct', cls: 'bg-red-100 text-red-700' },
]

function fmtCOP(n: number): string {
    return `$${Math.round(n).toLocaleString('es-CO')}`
}

export function AdminTablesClient({ grupos }: { grupos: Grupo[] }) {
    if (grupos.length === 0) {
        return (
            <Card>
                <CardContent className="py-12 text-center text-slate-500 text-sm">
                    Sin grupos para mostrar. Ajustá los filtros.
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-4">
            {grupos.map((grupo, idx) => (
                <Card key={idx} className="overflow-hidden">
                    <CardHeader className="bg-slate-50/60 border-b py-3 px-5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <CardTitle className="text-base text-slate-900">{grupo.nombre}</CardTitle>
                                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                                    <CalendarRange className="h-3 w-3" />
                                    Del {grupo.startString} al {grupo.endString}
                                </p>
                            </div>
                            <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 bg-white px-2.5 py-1 rounded-full border">
                                <span className="font-semibold text-slate-900">{grupo.datos.length}</span>
                                empleado(s)
                            </span>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {grupo.datos.length === 0 ? (
                            <div className="py-12 flex flex-col items-center gap-2 text-center text-slate-500">
                                <Inbox className="h-8 w-8 text-slate-300" />
                                <p className="text-sm">Sin jornadas registradas en este período.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-slate-50/40">
                                            <TableHead>Empleado</TableHead>
                                            <TableHead>Operación</TableHead>
                                            <TableHead className="text-right">Horas reales</TableHead>
                                            <TableHead>Desglose de recargos</TableHead>
                                            <TableHead className="text-right">Valor</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {grupo.datos.map((row) => (
                                            <TableRow key={row.cedula} className="hover:bg-slate-50/60">
                                                <TableCell>
                                                    <Link
                                                        href={`/empleados/${row.cedula}`}
                                                        className="block group"
                                                    >
                                                        <p className="font-medium text-slate-900 group-hover:text-blue-700 transition-colors">
                                                            {row.nombre}
                                                        </p>
                                                        <p className="text-xs text-slate-500 font-mono">{row.cedula}</p>
                                                    </Link>
                                                </TableCell>
                                                <TableCell className="text-sm text-slate-600">{row.operacion}</TableCell>
                                                <TableCell className="text-right">
                                                    <p className="font-mono tabular-nums font-semibold text-slate-900">
                                                        {row.horasTotalesFormato}
                                                    </p>
                                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                                        {row.totalMinutos.toLocaleString('es-CO')} min
                                                    </p>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-wrap gap-1.5 max-w-md">
                                                        {BADGE_TIPOS.filter(
                                                            (t) => ((row.detalleMinutos as unknown as Record<string, number>)[t.key] ?? 0) > 0,
                                                        ).map((t) => (
                                                            <span
                                                                key={t.key}
                                                                className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium rounded-md ${t.cls}`}
                                                            >
                                                                <span className="font-semibold">{t.label}</span>
                                                                <span className="font-mono tabular-nums opacity-80">
                                                                    {(row.horasFormato as unknown as Record<string, string>)[t.key]}
                                                                </span>
                                                            </span>
                                                        ))}
                                                        {BADGE_TIPOS.every(
                                                            (t) => ((row.detalleMinutos as unknown as Record<string, number>)[t.key] ?? 0) === 0,
                                                        ) && <span className="text-xs text-slate-400">Solo ordinarias</span>}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <p className="font-mono tabular-nums font-semibold text-emerald-600">
                                                        {fmtCOP(row.valorTotal)}
                                                    </p>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}

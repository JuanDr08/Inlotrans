import { createClient } from '@/lib/supabase/server'
import { calcularHorasTodosUsuariosPorPeriodo } from '@/lib/calculoHoras'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from '@/components/ui/badge'
import { AdminFilters } from './AdminFilters'
import { AdminExcelButton } from './AdminExcelButton'
import { Suspense } from 'react'

export default async function AdminPage({
    searchParams,
}: {
    searchParams: Promise<{ start?: string; end?: string; op?: string; mes?: string; anio?: string; periodo?: string }>
}) {
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

    const operaciones = pParams.op ? pParams.op.split(',') : []

    const gruposConDatos = await Promise.all(grupos.map(async (g) => {
        const datos = await calcularHorasTodosUsuariosPorPeriodo(g.start, g.end, operaciones)
        return { ...g, datos }
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
                <AdminFilters />
            </Suspense>

            {gruposConDatos.map((grupo, idx) => (
                <Card key={idx} className="mb-6">
                    <CardHeader className="bg-slate-50/50 border-b pb-4">
                        <CardTitle className="text-xl text-slate-800">{grupo.nombre}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                            Del {grupo.start.toLocaleDateString('es-CO')} al {grupo.end.toLocaleDateString('es-CO')}
                        </p>
                    </CardHeader>
                    <CardContent className="pt-6">
                        {grupo.datos.length === 0 ? (
                            <div className="text-center text-slate-500 py-8">
                                No se encontraron registros para este período.
                            </div>
                        ) : (
                            <div className="rounded-md border overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Empleado</TableHead>
                                            <TableHead>Horas Reales</TableHead>
                                            <TableHead className="w-[300px]">Desglose de Recargos</TableHead>
                                            <TableHead className="text-right">Total a Pagar</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {grupo.datos.map((row: any) => (
                                            <TableRow key={row.cedula}>
                                                <TableCell>
                                                    <div className="font-medium">{row.nombre}</div>
                                                    <div className="text-sm text-slate-500">ID: {row.cedula}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-semibold text-lg">{row.horasTotalesFormato}</div>
                                                    <div className="text-xs text-slate-400">{row.totalMinutos} mins</div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-wrap gap-1">
                                                        {row.detalleMinutos.extrasOrdinarias > 0 && (
                                                            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                                                                Extra: {row.horasFormato.extrasOrdinarias}
                                                            </Badge>
                                                        )}
                                                        {row.detalleMinutos.nocturnas > 0 && (
                                                            <Badge variant="secondary" className="bg-pink-100 text-pink-800 hover:bg-pink-100">
                                                                Nocturno: {row.horasFormato.nocturnas}
                                                            </Badge>
                                                        )}
                                                        {row.detalleMinutos.extrasNocturnas > 0 && (
                                                            <Badge variant="secondary" className="bg-red-100 text-red-800 hover:bg-red-100 font-bold">
                                                                Extra Noct: {row.horasFormato.extrasNocturnas}
                                                            </Badge>
                                                        )}
                                                        {row.detalleMinutos.festivos > 0 && (
                                                            <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                                                                Festivo: {row.horasFormato.festivos}
                                                            </Badge>
                                                        )}
                                                        {row.detalleMinutos.domingos > 0 && (
                                                            <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                                                                Domingo: {row.horasFormato.domingos}
                                                            </Badge>
                                                        )}
                                                        {row.detalleMinutos.extrasDominicalFestivo > 0 && (
                                                            <Badge variant="default" className="font-bold bg-orange-500 hover:bg-orange-500">
                                                                Extra Festivo: {row.horasFormato.extrasDominicalFestivo}
                                                            </Badge>
                                                        )}
                                                        {row.detalleMinutos.extrasNocturnaDominicalFestivo > 0 && (
                                                            <Badge variant="destructive" className="font-bold">
                                                                ExFes Noct: {row.horasFormato.extrasNocturnaDominicalFestivo}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="font-bold text-lg text-emerald-600">
                                                        ${row.valorTotal.toLocaleString('es-CO')}
                                                    </div>
                                                    <div className="text-xs text-slate-500">
                                                        Base: ${row.detalleValores.normal.toLocaleString('es-CO')}
                                                    </div>
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

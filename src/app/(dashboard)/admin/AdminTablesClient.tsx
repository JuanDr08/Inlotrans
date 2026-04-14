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
} from "@/components/ui/table"
import { Badge } from '@/components/ui/badge'

export function AdminTablesClient({ grupos }: { grupos: any[] }) {
    return (
        <>
            {grupos.map((grupo, idx) => (
                <Card key={idx} className="mb-6">
                    <CardHeader className="bg-slate-50/50 border-b pb-4">
                        <CardTitle className="text-xl text-slate-800">{grupo.nombre}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                            Del {grupo.startString} al {grupo.endString}
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
                                            {/* Columna de valor monetario comentada por solicitud
                                            <TableHead className="text-right">Total a Pagar</TableHead>
                                            */}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {grupo.datos.map((row: any) => (
                                            <TableRow key={row.cedula}>
                                                <TableCell>
                                                    <Link href={`/empleados/${row.cedula}`} className="hover:underline">
                                                        <div className="font-medium text-blue-700 hover:text-blue-900">{row.nombre}</div>
                                                        <div className="text-sm text-slate-500">ID: {row.cedula}</div>
                                                    </Link>
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
                                                {/* Valor monetario comentado por solicitud
                                                <TableCell className="text-right">
                                                    <div className="font-bold text-lg text-emerald-600">
                                                        ${row.valorTotal.toLocaleString('es-CO')}
                                                    </div>
                                                    <div className="text-xs text-slate-500">
                                                        Base: ${row.detalleValores.normal.toLocaleString('es-CO')}
                                                    </div>
                                                </TableCell>
                                                */}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            ))}
        </>
    )
}

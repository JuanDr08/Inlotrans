import { createClient } from '@/lib/supabase/server'
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
import { Button } from '@/components/ui/button'
import { NovedadesForm } from './NovedadesForm'
import Link from 'next/link'

export default async function NovedadesPage() {
    const supabase = await createClient()

    const { data: novedades } = await supabase
        .from('novedades')
        .select(`
            *,
            usuario:usuarios(nombre)
        `)
        .order('fecha_inicio', { ascending: false })

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Registro de Novedades</h1>
                    <p className="text-muted-foreground mt-1">Gestión de auxilios, deducciones e incapacidades médicas</p>
                </div>
                <Link href="/empleados">
                    <Button variant="outline" className="border-blue-600 text-blue-700 hover:bg-blue-50">
                        👥 Gestión de Usuarios
                    </Button>
                </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <div className="col-span-1">
                    <NovedadesForm />
                </div>

                <div className="col-span-1 lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Historial de Novedades ({novedades?.length || 0})</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Empleado (Cédula)</TableHead>
                                            <TableHead>Fechas</TableHead>
                                            <TableHead>Tipo / Concepto</TableHead>
                                            <TableHead>Justificación</TableHead>
                                            <TableHead className="text-right">Afecta Planilla</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {novedades?.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                    No hay novedades recientes registradas.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                        {novedades?.map((nov: any) => (
                                            <TableRow key={nov.id}>
                                                <TableCell>
                                                    <div className="font-medium text-sm">{nov.usuario?.nombre || 'Desconocido'}</div>
                                                    <div className="text-xs text-muted-foreground">{nov.usuario_id}</div>
                                                </TableCell>
                                                <TableCell>
                                                    {nov.tipo_novedad === 'incapacidad' ? (
                                                        <>
                                                            <div className="text-xs">Del: {new Date(nov.fecha_inicio).toLocaleDateString()}</div>
                                                            <div className="text-xs">Al: {new Date(nov.fecha_fin).toLocaleDateString()}</div>
                                                        </>
                                                    ) : (
                                                        <div className="text-xs">{new Date(nov.fecha_inicio).toLocaleDateString()}</div>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={nov.tipo_novedad === 'incapacidad' ? "destructive" : "secondary"} className="text-[10px] uppercase">
                                                        {nov.tipo_novedad.replace('_', ' ')}
                                                    </Badge>
                                                    {nov.valor_monetario && (
                                                        <div className="text-xs font-semibold text-emerald-600 mt-1">
                                                            $ {nov.valor_monetario.toLocaleString()}
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <p className="max-w-[200px] truncate text-xs text-slate-600" title={nov.notas}>
                                                        {nov.notas || '-'}
                                                    </p>
                                                    {nov.causa_codigo && (
                                                        <span className="text-[10px] bg-slate-100 text-slate-500 px-1 py-0.5 rounded mt-1 inline-block">
                                                            EPS: {nov.causa_codigo}
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {nov.es_remunerado ? (
                                                        <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200">Sí</Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-slate-500 bg-slate-50">No</Badge>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}

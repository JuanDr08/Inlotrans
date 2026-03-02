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
import { EmpleadoForm } from './EmpleadoForm'
import Link from 'next/link'

export default async function EmpleadosPage() {
    const supabase = await createClient()

    const { data: empleados } = await supabase
        .from('usuarios')
        .select('*')
        .order('nombre', { ascending: true })

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Gestión de Usuarios</h1>
                    <p className="text-muted-foreground mt-1">Directorio y creación de personal operativo y administrativo</p>
                </div>
                <Link href="/novedades">
                    <Button variant="outline" className="border-purple-600 text-purple-700 hover:bg-purple-50">
                        📋 Registro de Novedades
                    </Button>
                </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <div className="col-span-1">
                    <EmpleadoForm />
                </div>
                <div className="col-span-1 lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Usuarios Registrados ({empleados?.length || 0})</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Cédula</TableHead>
                                            <TableHead>Nombre Completo</TableHead>
                                            <TableHead>Operación Base</TableHead>
                                            <TableHead>Estado</TableHead>
                                            <TableHead className="text-right">Acciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {empleados?.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                    No hay empleados registrados.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                        {empleados?.map((emp: any) => (
                                            <TableRow key={emp.id}>
                                                <TableCell className="font-semibold">{emp.id}</TableCell>
                                                <TableCell>
                                                    <div className="font-medium text-sm">{emp.nombre}</div>
                                                    <div className="text-xs text-muted-foreground">{emp.cargo}</div>
                                                </TableCell>
                                                <TableCell>{emp.operacion}</TableCell>
                                                <TableCell>
                                                    {emp.status === 'activo' ? (
                                                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Activo</Badge>
                                                    ) : (
                                                        <Badge variant="destructive">Inactivo</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="sm" className="text-blue-600">Editar</Button>
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

import { getD1 } from '@/lib/d1/client'
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
import { DeleteNovedadButton } from './DeleteNovedadButton'
import { Pagination } from '@/components/Pagination'
import Link from 'next/link'
import { getUserProfile } from '@/lib/auth'
import { redirect } from 'next/navigation'

const PAGE_SIZE = 10

export default async function NovedadesPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string }>
}) {
    const profile = await getUserProfile()
    if (!profile) redirect('/')

    const pParams = await searchParams
    const page = Math.max(1, parseInt(pParams.page ?? '1', 10) || 1)
    const offset = (page - 1) * PAGE_SIZE

    const db = getD1()

    const isCoordinador = profile.rol === 'coordinador' && profile.operacion_nombre

    const baseWhere = `WHERE n.fecha_novedad >= date('now', '-90 days')`
    const opFilter = isCoordinador ? ` AND u.operacion = ?` : ''

    const listParams: unknown[] = []
    if (isCoordinador) listParams.push(profile.operacion_nombre)
    listParams.push(PAGE_SIZE, offset)

    const countParams: unknown[] = []
    if (isCoordinador) countParams.push(profile.operacion_nombre)

    const [{ results: novedadesRaw }, countRow] = await Promise.all([
        db.prepare(
            `SELECT n.id, n.usuario_id, n.usuario_nombre, n.tipo_novedad,
                n.fecha_novedad, n.fecha_inicio, n.fecha_fin,
                n.es_pagado, n.codigo_causa, n.valor_monetario, n.descripcion, n.created_at,
                u.nombre as usuario_real_nombre, u.operacion as usuario_operacion
         FROM novedades n
         LEFT JOIN usuarios u ON u.id = n.usuario_id
         ${baseWhere}${opFilter}
         ORDER BY n.fecha_novedad DESC
         LIMIT ? OFFSET ?`
        ).bind(...listParams).all(),
        db.prepare(
            `SELECT COUNT(*) as total
         FROM novedades n
         LEFT JOIN usuarios u ON u.id = n.usuario_id
         ${baseWhere}${opFilter}`
        ).bind(...countParams).first<{ total: number }>(),
    ])

    const total = countRow?.total ?? 0

    type NovedadRow = {
        id: string
        usuario_id: string
        usuario_nombre: string
        tipo_novedad: string
        fecha_novedad: string
        fecha_inicio: string | null
        fecha_fin: string | null
        es_pagado: number
        codigo_causa: number | null
        valor_monetario: number | null
        descripcion: string | null
        usuario_real_nombre: string | null
        usuario_operacion: string | null
    }

    const rawRows = (novedadesRaw ?? []) as unknown as NovedadRow[]

    const novedades = rawRows.map(r => ({
        id: r.id,
        usuario_id: r.usuario_id,
        usuario_nombre: r.usuario_nombre,
        tipo_novedad: r.tipo_novedad,
        fecha_novedad: r.fecha_novedad,
        fecha_inicio: r.fecha_inicio,
        fecha_fin: r.fecha_fin,
        es_pagado: !!r.es_pagado,
        codigo_causa: r.codigo_causa,
        valor_monetario: r.valor_monetario,
        descripcion: r.descripcion,
        usuario: r.usuario_real_nombre
            ? { nombre: r.usuario_real_nombre, operacion: r.usuario_operacion ?? undefined }
            : undefined,
    }))

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
                    <NovedadesForm rol={profile.rol} />
                </div>

                <div className="col-span-1 lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Historial de Novedades ({total})</CardTitle>
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
                                            {profile.rol === 'admin' && <TableHead className="text-right">Acciones</TableHead>}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {novedades?.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={profile.rol === 'admin' ? 6 : 5} className="text-center py-8 text-muted-foreground">
                                                    No hay novedades recientes registradas.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                        {novedades?.map((nov) => {
                                            const usuarioRel = nov.usuario
                                            return (
                                            <TableRow key={nov.id}>
                                                <TableCell>
                                                    <div className="font-medium text-sm">{usuarioRel?.nombre || nov.usuario_nombre || 'Desconocido'}</div>
                                                    <div className="text-xs text-muted-foreground">{nov.usuario_id}</div>
                                                </TableCell>
                                                <TableCell>
                                                    {nov.fecha_inicio && nov.fecha_fin ? (
                                                        <>
                                                            <div className="text-xs">Del: {new Date(nov.fecha_inicio).toLocaleDateString('es-CO')}</div>
                                                            <div className="text-xs">Al: {new Date(nov.fecha_fin).toLocaleDateString('es-CO')}</div>
                                                        </>
                                                    ) : (
                                                        <div className="text-xs">{new Date(nov.fecha_novedad).toLocaleDateString('es-CO')}</div>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant={nov.tipo_novedad.startsWith('INCAPACIDAD') ? 'destructive' : 'secondary'}
                                                        className="text-[10px] uppercase"
                                                    >
                                                        {nov.tipo_novedad.replace(/_/g, ' ')}
                                                    </Badge>
                                                    {nov.valor_monetario && (
                                                        <div className="text-xs font-semibold text-emerald-600 mt-1">
                                                            $ {nov.valor_monetario.toLocaleString('es-CO')}
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <p className="max-w-[200px] truncate text-xs text-slate-600" title={nov.descripcion ?? ''}>
                                                        {nov.descripcion || '-'}
                                                    </p>
                                                    {nov.codigo_causa && (
                                                        <span className="text-[10px] bg-slate-100 text-slate-500 px-1 py-0.5 rounded mt-1 inline-block">
                                                            EPS: {nov.codigo_causa}
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {nov.es_pagado ? (
                                                        <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200">Sí</Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-slate-500 bg-slate-50">No</Badge>
                                                    )}
                                                </TableCell>
                                                {profile.rol === 'admin' && (
                                                    <TableCell className="text-right">
                                                        <DeleteNovedadButton id={nov.id} />
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </div>

                            <Pagination page={page} pageSize={PAGE_SIZE} total={total} />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}

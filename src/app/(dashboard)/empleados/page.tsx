import { getD1 } from '@/lib/d1/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmpleadoForm } from './EmpleadoForm'
import { Button } from '@/components/ui/button'
import { EmpleadosTable } from './EmpleadosTable'
import Link from 'next/link'
import { getOperacionesActivas } from '../admin/operaciones-actions'
import { getUserProfile } from '@/lib/auth'
import { redirect } from 'next/navigation'

const PAGE_SIZE = 10

export default async function EmpleadosPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string; q?: string }>
}) {
    const profile = await getUserProfile()
    if (!profile) redirect('/')

    const pParams = await searchParams
    const page = Math.max(1, parseInt(pParams.page ?? '1', 10) || 1)
    const offset = (page - 1) * PAGE_SIZE
    const search = (pParams.q ?? '').trim()

    const db = getD1()

    let empleados
    let total = 0

    const isCoord = profile.rol === 'coordinador' && !!profile.operacion_nombre
    const hasSearch = search.length > 0
    const likePattern = `%${search}%`

    const whereParts: string[] = []
    const bindsData: unknown[] = []
    const bindsCount: unknown[] = []

    if (isCoord) {
        whereParts.push('operacion = ?')
        bindsData.push(profile.operacion_nombre)
        bindsCount.push(profile.operacion_nombre)
    }
    if (hasSearch) {
        whereParts.push('(id LIKE ? OR nombre LIKE ?)')
        bindsData.push(likePattern, likePattern)
        bindsCount.push(likePattern, likePattern)
    }

    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : ''

    const dataStmt = db.prepare(
        `SELECT id, nombre, cargo, operacion, status, salario FROM usuarios ${whereClause} ORDER BY nombre ASC LIMIT ? OFFSET ?`
    )
    const countStmt = db.prepare(
        `SELECT COUNT(*) as total FROM usuarios ${whereClause}`
    )

    const [{ results }, countRow] = await Promise.all([
        dataStmt.bind(...bindsData, PAGE_SIZE, offset).all(),
        bindsCount.length > 0
            ? countStmt.bind(...bindsCount).first<{ total: number }>()
            : countStmt.first<{ total: number }>(),
    ])
    empleados = results
    total = countRow?.total ?? 0

    const resOps = await getOperacionesActivas()
    const allOperaciones = resOps.success && resOps.data ? resOps.data : []

    const operaciones = profile.rol === 'coordinador' && profile.operacion_nombre
        ? allOperaciones.filter(op => op.nombre === profile.operacion_nombre)
        : allOperaciones

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
                    <EmpleadoForm
                        operaciones={operaciones}
                        rol={profile.rol}
                        operacionFija={profile.operacion_nombre}
                    />
                </div>
                <div className="col-span-1 lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Usuarios Registrados ({total})</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <EmpleadosTable
                                empleados={empleados || []}
                                operaciones={operaciones}
                                rol={profile.rol}
                                total={total}
                                page={page}
                                pageSize={PAGE_SIZE}
                                initialSearch={search}
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}

import { getUserProfile, requireAdmin } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { listarUsuarios } from '../usuarios-actions'
import { getOperacionesAdmin } from '../operaciones-actions'
import { UsuariosClient } from './UsuariosClient'

export default async function UsuariosPage() {
    const profile = await getUserProfile()
    if (!profile) redirect('/')
    requireAdmin(profile)

    const [resUsuarios, resOps] = await Promise.all([
        listarUsuarios(),
        getOperacionesAdmin()
    ])

    const usuarios = resUsuarios.success && resUsuarios.data ? resUsuarios.data : []
    const operaciones = resOps.success && resOps.data ? resOps.data : []

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Gestión de Usuarios del Sistema</h1>
                <p className="text-muted-foreground mt-1">
                    Administra cuentas de acceso al dashboard (administradores y coordinadores)
                </p>
            </div>

            <UsuariosClient
                usuarios={usuarios}
                operaciones={operaciones}
            />
        </div>
    )
}

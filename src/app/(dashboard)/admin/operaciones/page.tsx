import { getOperacionesAdmin } from '../operaciones-actions'
import { OperacionesClient } from './OperacionesClient'

export const metadata = {
    title: 'Admin - Operaciones',
}

export default async function OperacionesPage() {
    const { data: operaciones, success, error } = await getOperacionesAdmin()

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Gestión de Operaciones</h1>
                    <p className="text-muted-foreground mt-1">Configura las operaciones donde pueden registrarse los empleados</p>
                </div>
            </div>

            {!success && (
                <div className="bg-red-50 text-red-600 p-4 rounded-md">
                    Error al cargar operaciones: {error}
                </div>
            )}

            {operaciones && <OperacionesClient initialData={operaciones} />}
        </div>
    )
}

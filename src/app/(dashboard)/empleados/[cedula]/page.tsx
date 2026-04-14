import { getUserProfile } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { getEmpleadoDetalle, getRegistrosRango, getNovedadesEmpleado } from './actions'
import { calcularHorasUsuarioPorPeriodo } from '@/lib/calculoHoras'
import { EmpleadoDetalleClient } from './EmpleadoDetalleClient'

export default async function EmpleadoDetallePage({
    params,
}: {
    params: Promise<{ cedula: string }>
}) {
    const profile = await getUserProfile()
    if (!profile) redirect('/')

    const { cedula } = await params

    const empleado = await getEmpleadoDetalle(cedula)
    if (!empleado) notFound()

    // Coordinador solo puede ver empleados de su operacion
    if (profile.rol === 'coordinador' && empleado.operacion !== profile.operacion_nombre) {
        redirect('/empleados')
    }

    // Datos del mes actual
    const now = new Date()
    const mesInicio = new Date(now.getFullYear(), now.getMonth(), 1)
    const mesFin = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

    // Fetch en paralelo: registros del mes, novedades, calculo de horas
    const [registrosMes, novedades, horasMes] = await Promise.all([
        getRegistrosRango(cedula, mesInicio.toISOString(), mesFin.toISOString()),
        getNovedadesEmpleado(cedula),
        calcularHorasUsuarioPorPeriodo(cedula, mesInicio, mesFin).catch(() => null)
    ])

    return (
        <EmpleadoDetalleClient
            empleado={empleado}
            registrosMes={registrosMes}
            novedades={novedades}
            horasMes={horasMes}
            rol={profile.rol}
        />
    )
}

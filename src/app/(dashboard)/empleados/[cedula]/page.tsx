import { getUserProfile } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import {
    getEmpleadoDetalle,
    getJornadasRango,
    getNovedadesEmpleado,
    getMovimientosBolsa,
    getAprobacionesEmpleado,
    getAlertasEmpleado,
    getSemanaDominicalActual,
    getTurnoOperacion,
} from './actions'
import { calcularHorasUsuarioEnPeriodo } from '@/lib/reportes'
import { obtenerBolsaHoras } from '@/lib/jornadas'
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

    if (profile.rol === 'coordinador' && empleado.operacion !== profile.operacion_nombre) {
        redirect('/empleados')
    }

    // Rango del mes actual (en hora local del server)
    const now = new Date()
    const mesInicio = new Date(now.getFullYear(), now.getMonth(), 1)
    const mesFin = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

    const [
        jornadasMes,
        novedades,
        horasMes,
        bolsaSaldo,
        movimientosBolsa,
        aprobaciones,
        alertas,
        semanaDominical,
        configOperacion,
    ] = await Promise.all([
        getJornadasRango(cedula, mesInicio.toISOString(), mesFin.toISOString()),
        getNovedadesEmpleado(cedula),
        calcularHorasUsuarioEnPeriodo(cedula, mesInicio, mesFin).catch(() => null),
        obtenerBolsaHoras(cedula).catch(() => 0),
        getMovimientosBolsa(cedula, 15),
        getAprobacionesEmpleado(cedula, 10),
        getAlertasEmpleado(cedula),
        getSemanaDominicalActual(cedula),
        getTurnoOperacion(empleado.operacion),
    ])

    return (
        <EmpleadoDetalleClient
            empleado={empleado}
            jornadasMes={jornadasMes}
            novedades={novedades}
            horasMes={horasMes}
            bolsaSaldo={bolsaSaldo}
            movimientosBolsa={movimientosBolsa}
            aprobaciones={aprobaciones}
            alertas={alertas}
            semanaDominical={semanaDominical}
            configOperacion={configOperacion}
            mesRango={{ inicio: mesInicio.toISOString(), fin: mesFin.toISOString() }}
            rol={profile.rol}
        />
    )
}

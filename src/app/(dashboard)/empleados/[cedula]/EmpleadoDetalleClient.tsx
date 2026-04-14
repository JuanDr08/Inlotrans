'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
    ArrowLeft, Clock, Calendar, User, Briefcase,
    LogIn, LogOut, Coffee, Play, Sun, FileText, DollarSign
} from 'lucide-react'
import { getRegistrosPorDia } from './actions'

type TipoRegistro = 'ENTRADA' | 'SALIDA' | 'PAUSA_INICIO' | 'PAUSA_FIN'

const tipoConfig: Record<TipoRegistro, { label: string; icon: typeof LogIn; color: string; bg: string }> = {
    ENTRADA: { label: 'Entrada', icon: LogIn, color: 'text-blue-700', bg: 'bg-blue-100' },
    SALIDA: { label: 'Salida', icon: LogOut, color: 'text-red-700', bg: 'bg-red-100' },
    PAUSA_INICIO: { label: 'Pausa', icon: Coffee, color: 'text-amber-700', bg: 'bg-amber-100' },
    PAUSA_FIN: { label: 'Reanudar', icon: Play, color: 'text-emerald-700', bg: 'bg-emerald-100' },
}

function formatHoraColombia(fechaISO: string) {
    // Crear fecha y restar 5h para Colombia
    const d = new Date(fechaISO)
    const colombiaMs = d.getTime() - (5 * 60 * 60 * 1000)
    const col = new Date(colombiaMs)
    const h = col.getUTCHours()
    const m = col.getUTCMinutes()
    const ampm = h >= 12 ? 'p.m.' : 'a.m.'
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`
}

function formatFechaCorta(fechaISO: string) {
    return new Date(fechaISO).toLocaleDateString('es-CO', {
        day: '2-digit', month: '2-digit', year: 'numeric'
    })
}

function getIniciales(nombre: string) {
    return nombre.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

function fechaColombiaKey(fechaISO: string): string {
    const d = new Date(fechaISO)
    const colombiaMs = d.getTime() - (5 * 60 * 60 * 1000)
    const col = new Date(colombiaMs)
    return `${col.getUTCFullYear()}-${String(col.getUTCMonth() + 1).padStart(2, '0')}-${String(col.getUTCDate()).padStart(2, '0')}`
}

// Representacion de un turno completo (ENTRADA -> ... -> SALIDA)
type TurnoRegistrado = {
    fecha: string // YYYY-MM-DD de la ENTRADA (fecha referencia)
    registros: any[] // todos los registros del turno en orden cronologico
    entrada: any | null
    salida: any | null
    pausas: number
    abierto: boolean // true si no tiene SALIDA
}

// Agrupar registros por TURNOS (pares ENTRADA->SALIDA), no por dia calendario.
// Esto resuelve turnos nocturnos que cruzan medianoche.
function agruparPorTurnos(registros: any[]): TurnoRegistrado[] {
    const turnos: TurnoRegistrado[] = []
    let turnoActual: TurnoRegistrado | null = null

    for (const reg of registros) {
        if (reg.tipo === 'ENTRADA') {
            // Si hay un turno abierto anterior, cerrarlo como abierto
            if (turnoActual) {
                turnos.push(turnoActual)
            }
            turnoActual = {
                fecha: fechaColombiaKey(reg.fecha_hora),
                registros: [reg],
                entrada: reg,
                salida: null,
                pausas: 0,
                abierto: true,
            }
        } else if (turnoActual) {
            turnoActual.registros.push(reg)
            if (reg.tipo === 'SALIDA') {
                turnoActual.salida = reg
                turnoActual.abierto = false
                turnos.push(turnoActual)
                turnoActual = null
            } else if (reg.tipo === 'PAUSA_INICIO') {
                turnoActual.pausas++
            }
        }
        // Ignorar SALIDA/PAUSA sin ENTRADA previa
    }

    // Turno abierto sin cerrar
    if (turnoActual) {
        turnos.push(turnoActual)
    }

    return turnos
}

// Indexar turnos por fecha de entrada para merge con novedades
function indexarTurnosPorFecha(turnos: TurnoRegistrado[]): Record<string, TurnoRegistrado[]> {
    const map: Record<string, TurnoRegistrado[]> = {}
    for (const t of turnos) {
        if (!map[t.fecha]) map[t.fecha] = []
        map[t.fecha].push(t)
    }
    return map
}

// Calcular horas trabajadas de un turno a partir de sus registros
function calcularHorasTurno(registros: any[]) {
    let totalMs = 0
    let pausaMs = 0
    let entradaActual: number | null = null
    let pausaInicio: number | null = null

    for (const reg of registros) {
        const ts = new Date(reg.fecha_hora).getTime()
        if (reg.tipo === 'ENTRADA') {
            entradaActual = ts
        } else if (reg.tipo === 'SALIDA' && entradaActual !== null) {
            totalMs += ts - entradaActual
            entradaActual = null
        } else if (reg.tipo === 'PAUSA_INICIO') {
            pausaInicio = ts
        } else if (reg.tipo === 'PAUSA_FIN' && pausaInicio !== null) {
            pausaMs += ts - pausaInicio
            pausaInicio = null
        }
    }

    const trabajadoMs = Math.max(0, totalMs - pausaMs)
    const horas = Math.floor(trabajadoMs / 3600000)
    const minutos = Math.floor((trabajadoMs % 3600000) / 60000)
    return { horas, minutos, totalMs: trabajadoMs, pausaMs }
}

// Obtener fechas de novedades como claves YYYY-MM-DD
function getNovedadDias(novedades: any[]): Record<string, any[]> {
    const map: Record<string, any[]> = {}
    for (const nov of novedades) {
        if (nov.start_date && nov.end_date) {
            const start = new Date(nov.start_date)
            const end = new Date(nov.end_date)
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const key = d.toISOString().slice(0, 10)
                if (!map[key]) map[key] = []
                map[key].push(nov)
            }
        } else if (nov.fecha_novedad) {
            const key = nov.fecha_novedad.slice(0, 10)
            if (!map[key]) map[key] = []
            map[key].push(nov)
        }
    }
    return map
}

export function EmpleadoDetalleClient({
    empleado,
    registrosMes,
    novedades,
    horasMes,
    rol,
}: {
    empleado: any
    registrosMes: any[]
    novedades: any[]
    horasMes: any
    rol: string
}) {
    const router = useRouter()
    const [activeTab, setActiveTab] = useState('timeline')
    const [fechaDetalle, setFechaDetalle] = useState('')
    const [registrosDia, setRegistrosDia] = useState<any[]>([])
    const [cargandoDia, setCargandoDia] = useState(false)

    // Agrupar por TURNOS (ENTRADA->SALIDA), no por dia calendario
    const turnosDelMes = agruparPorTurnos(registrosMes)
    const turnosPorFecha = indexarTurnosPorFecha(turnosDelMes)
    const novedadDias = getNovedadDias(novedades)

    // Combinar fechas de turnos y novedades
    const todasLasFechas = new Set([...Object.keys(turnosPorFecha), ...Object.keys(novedadDias)])
    const fechasOrdenadas = Array.from(todasLasFechas).sort().reverse()

    const turno = empleado.turno

    const handleVerDia = async (fecha: string) => {
        setFechaDetalle(fecha)
        setActiveTab('dia')
        setCargandoDia(true)
        const regs = await getRegistrosPorDia(empleado.id, fecha)
        setRegistrosDia(regs)
        setCargandoDia(false)
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <h1 className="text-2xl font-bold tracking-tight">Detalle del Empleado</h1>
            </div>

            {/* Perfil + Resumen */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <Card className="lg:col-span-1">
                    <CardContent className="pt-6">
                        <div className="flex flex-col items-center text-center">
                            <Avatar className="h-20 w-20 mb-4">
                                <AvatarFallback className="text-2xl font-bold bg-blue-100 text-blue-700">
                                    {getIniciales(empleado.nombre)}
                                </AvatarFallback>
                            </Avatar>
                            <h2 className="text-lg font-semibold">{empleado.nombre}</h2>
                            <p className="text-sm text-muted-foreground">{empleado.cargo}</p>
                            <Badge variant={empleado.status === 'activo' ? 'secondary' : 'destructive'} className={empleado.status === 'activo' ? 'bg-emerald-100 text-emerald-800 mt-2' : 'mt-2'}>
                                {empleado.status}
                            </Badge>
                        </div>
                        <Separator className="my-4" />
                        <div className="space-y-3 text-sm">
                            <InfoRow icon={User} label="Cédula" value={empleado.id} />
                            <InfoRow icon={Briefcase} label="Operación" value={empleado.operacion} />
                            {empleado.salario && <InfoRow icon={DollarSign} label="Salario" value={`$${Number(empleado.salario).toLocaleString('es-CO')}`} />}
                            {turno && <InfoRow icon={Clock} label="Turno" value={turno.nombre} />}
                            {turno && <InfoRow icon={Sun} label="Horario" value={`${turno.hora_inicio.slice(0, 5)} — ${turno.hora_fin.slice(0, 5)}`} />}
                            {empleado.birthdate && <InfoRow icon={Calendar} label="Nacimiento" value={new Date(empleado.birthdate).toLocaleDateString('es-CO')} />}
                        </div>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-3">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Resumen del Mes Actual</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {horasMes ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                <MiniStat label="Total Trabajado" value={horasMes.horasTotalesFormato} accent="blue" />
                                <MiniStat label="Normales" value={horasMes.horasFormato.normales} accent="slate" />
                                <MiniStat label="Extras Diurnas" value={horasMes.horasFormato.extrasOrdinarias} accent="green" />
                                <MiniStat label="Nocturnas" value={horasMes.horasFormato.nocturnas} accent="purple" />
                                <MiniStat label="Extras Nocturnas" value={horasMes.horasFormato.extrasNocturnas} accent="red" />
                                <MiniStat label="Domingos" value={horasMes.horasFormato.domingos} accent="blue" />
                                <MiniStat label="Festivos" value={horasMes.horasFormato.festivos} accent="amber" />
                                <MiniStat label="Dom/Fest Nocturno" value={horasMes.horasFormato.domingosFestivosNocturnos} accent="purple" />
                                <MiniStat label="Extra Dom/Fest" value={horasMes.horasFormato.extrasDominicalFestivo} accent="amber" />
                                <MiniStat label="Extra Noct Dom/Fest" value={horasMes.horasFormato.extrasNocturnaDominicalFestivo} accent="red" />
                                {/* Valor monetario comentado por solicitud
                                <MiniStat label="Total a Pagar" value={`$${horasMes.valorTotal?.toLocaleString('es-CO')}`} accent="emerald" />
                                */}
                            </div>
                        ) : (
                            <p className="text-muted-foreground text-sm py-4">Sin registros este mes</p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="timeline">Historial del Mes</TabsTrigger>
                    <TabsTrigger value="dia">Detalle por Día</TabsTrigger>
                    <TabsTrigger value="novedades">Novedades ({novedades.length})</TabsTrigger>
                </TabsList>

                {/* Tab: Timeline */}
                <TabsContent value="timeline" className="mt-4">
                    <Card>
                        <CardContent className="pt-6">
                            {fechasOrdenadas.length === 0 ? (
                                <p className="text-muted-foreground text-center py-8">Sin actividad este mes</p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Fecha</TableHead>
                                            <TableHead>Entrada</TableHead>
                                            <TableHead>Salida</TableHead>
                                            <TableHead>Pausas</TableHead>
                                            <TableHead>Trabajado</TableHead>
                                            <TableHead>Novedad</TableHead>
                                            <TableHead className="text-right">Acciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {fechasOrdenadas.map(fecha => {
                                            const turnosDeEstaFecha = turnosPorFecha[fecha] || []
                                            const novsDelDia = novedadDias[fecha] || []

                                            // Si hay turnos, mostrar una fila por turno
                                            if (turnosDeEstaFecha.length > 0) {
                                                return turnosDeEstaFecha.map((t, idx) => {
                                                    const { horas, minutos } = calcularHorasTurno(t.registros)

                                                    // Detectar llegada tarde
                                                    let llegadaTarde = false
                                                    if (turno && t.entrada) {
                                                        const entradaMs = new Date(t.entrada.fecha_hora).getTime() - (5 * 3600000)
                                                        const col = new Date(entradaMs)
                                                        const [tH, tM] = turno.hora_inicio.split(':').map(Number)
                                                        const entradaMin = col.getUTCHours() * 60 + col.getUTCMinutes()
                                                        const turnoMin = tH * 60 + tM + 5
                                                        if (entradaMin > turnoMin) llegadaTarde = true
                                                    }

                                                    // Si la salida es en otro dia, mostrar ambas fechas
                                                    const salidaEnOtroDia = t.salida && fechaColombiaKey(t.salida.fecha_hora) !== t.fecha

                                                    return (
                                                        <TableRow key={`${fecha}-${idx}`} className="cursor-pointer hover:bg-slate-50" onClick={() => handleVerDia(fecha)}>
                                                            <TableCell className="font-medium text-sm">
                                                                {new Date(fecha + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short' })}
                                                            </TableCell>
                                                            <TableCell>
                                                                {t.entrada ? (
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="text-sm">{formatHoraColombia(t.entrada.fecha_hora)}</span>
                                                                        {llegadaTarde && <Badge variant="destructive" className="text-[10px] px-1 py-0">Tarde</Badge>}
                                                                    </div>
                                                                ) : <span className="text-muted-foreground text-sm">—</span>}
                                                            </TableCell>
                                                            <TableCell className="text-sm">
                                                                {t.salida ? (
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span>{formatHoraColombia(t.salida.fecha_hora)}</span>
                                                                        {salidaEnOtroDia && (
                                                                            <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-blue-100 text-blue-700">
                                                                                +1d
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                ) : <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-[10px]">Abierto</Badge>}
                                                            </TableCell>
                                                            <TableCell className="text-sm">
                                                                {t.pausas > 0 ? <Badge variant="secondary" className="text-[10px]">{t.pausas}</Badge> : '—'}
                                                            </TableCell>
                                                            <TableCell className="text-sm font-medium">
                                                                {(horas > 0 || minutos > 0) ? `${horas}h ${minutos}m` : <span className="text-muted-foreground">En curso</span>}
                                                            </TableCell>
                                                            <TableCell>
                                                                {idx === 0 && novsDelDia.length > 0 ? (
                                                                    <Badge variant="secondary" className="bg-purple-100 text-purple-700 text-[10px]">
                                                                        {novsDelDia[0].tipo_novedad}
                                                                    </Badge>
                                                                ) : null}
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <Button variant="ghost" size="sm" className="text-blue-600 text-xs" onClick={(e) => { e.stopPropagation(); handleVerDia(fecha) }}>
                                                                    Ver detalle
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    )
                                                })
                                            }

                                            // Dia solo con novedad (sin registros)
                                            return (
                                                <TableRow key={fecha} className="cursor-pointer hover:bg-slate-50" onClick={() => handleVerDia(fecha)}>
                                                    <TableCell className="font-medium text-sm">
                                                        {new Date(fecha + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short' })}
                                                    </TableCell>
                                                    <TableCell><span className="text-muted-foreground text-sm">—</span></TableCell>
                                                    <TableCell><span className="text-muted-foreground text-sm">—</span></TableCell>
                                                    <TableCell><span className="text-muted-foreground text-sm">—</span></TableCell>
                                                    <TableCell><span className="text-muted-foreground text-sm">—</span></TableCell>
                                                    <TableCell>
                                                        {novsDelDia.length > 0 && (
                                                            <Badge variant="secondary" className="bg-purple-100 text-purple-700 text-[10px]">
                                                                {novsDelDia[0].tipo_novedad}
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="sm" className="text-blue-600 text-xs" onClick={(e) => { e.stopPropagation(); handleVerDia(fecha) }}>
                                                            Ver detalle
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab: Detalle por dia */}
                <TabsContent value="dia" className="mt-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-3">
                                <CardTitle className="text-lg">Detalle del Día</CardTitle>
                                <Input type="date" value={fechaDetalle} onChange={e => handleVerDia(e.target.value)} className="w-auto" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            {!fechaDetalle ? (
                                <p className="text-muted-foreground text-center py-8">Selecciona una fecha o haz click en un día del historial</p>
                            ) : cargandoDia ? (
                                <p className="text-muted-foreground text-center py-8">Cargando...</p>
                            ) : (
                                <div className="space-y-6">
                                    {/* Novedades del dia */}
                                    {(novedadDias[fechaDetalle] || []).length > 0 && (
                                        <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
                                            <div className="flex items-center gap-2 mb-1">
                                                <FileText className="h-4 w-4 text-purple-600" />
                                                <span className="text-sm font-semibold text-purple-700">Novedades del día</span>
                                            </div>
                                            {(novedadDias[fechaDetalle] || []).map((nov: any, i: number) => (
                                                <div key={i} className="text-sm text-purple-800 mt-1">
                                                    <Badge variant="secondary" className="bg-purple-200 text-purple-800 text-[10px] mr-2">{nov.tipo_novedad}</Badge>
                                                    {nov.razon}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {registrosDia.length === 0 && (novedadDias[fechaDetalle] || []).length === 0 ? (
                                        <p className="text-muted-foreground text-center py-8">Sin actividad para este día</p>
                                    ) : registrosDia.length > 0 ? (
                                        <>
                                            {/* Resumen rapido */}
                                            {(() => {
                                                const { horas, minutos, pausaMs } = calcularHorasTurno(registrosDia)
                                                const pausaMin = Math.floor(pausaMs / 60000)
                                                return (
                                                    <div className="grid grid-cols-3 gap-3">
                                                        <MiniStat label="Trabajado" value={`${horas}h ${minutos}m`} accent="blue" />
                                                        <MiniStat label="Pausas" value={`${Math.floor(pausaMin / 60)}h ${pausaMin % 60}m`} accent="amber" />
                                                        <MiniStat label="Registros" value={String(registrosDia.length)} accent="slate" />
                                                    </div>
                                                )
                                            })()}

                                            {/* Timeline visual */}
                                            <div className="relative pl-8 space-y-0">
                                                {registrosDia.map((reg: any, i: number) => {
                                                    const config = tipoConfig[reg.tipo as TipoRegistro] || tipoConfig.ENTRADA
                                                    const Icon = config.icon
                                                    const isLast = i === registrosDia.length - 1

                                                    return (
                                                        <div key={reg.row_number} className="relative pb-6">
                                                            {!isLast && <div className="absolute left-[-16px] top-8 bottom-0 w-px bg-slate-200" />}
                                                            <div className={`absolute left-[-24px] top-1.5 h-4 w-4 rounded-full ${config.bg} flex items-center justify-center ring-2 ring-white`}>
                                                                <div className={`h-2 w-2 rounded-full ${config.color.replace('text-', 'bg-')}`} />
                                                            </div>
                                                            <div className="flex items-start gap-3">
                                                                <div className={`p-2 rounded-lg ${config.bg}`}>
                                                                    <Icon className={`h-4 w-4 ${config.color}`} />
                                                                </div>
                                                                <div className="flex-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={`text-sm font-semibold ${config.color}`}>{config.label}</span>
                                                                        <span className="text-sm text-muted-foreground">{formatHoraColombia(reg.fecha_hora)}</span>
                                                                    </div>
                                                                    <p className="text-xs text-muted-foreground mt-0.5">{reg.operacion}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </>
                                    ) : null}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab: Novedades */}
                <TabsContent value="novedades" className="mt-4">
                    <Card>
                        <CardContent className="pt-6">
                            {novedades.length === 0 ? (
                                <p className="text-muted-foreground text-center py-8">Sin novedades registradas</p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Tipo</TableHead>
                                            <TableHead>Fecha</TableHead>
                                            <TableHead>Razón</TableHead>
                                            <TableHead>Remunerable</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {novedades.map((nov: any) => (
                                            <TableRow key={nov.id}>
                                                <TableCell>
                                                    <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-800">
                                                        {nov.tipo_novedad}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    {nov.start_date && nov.end_date
                                                        ? `${formatFechaCorta(nov.start_date)} — ${formatFechaCorta(nov.end_date)}`
                                                        : nov.fecha_novedad ? formatFechaCorta(nov.fecha_novedad) : '—'
                                                    }
                                                </TableCell>
                                                <TableCell className="text-sm max-w-xs truncate">{nov.razon || '—'}</TableCell>
                                                <TableCell>
                                                    {nov.remunerable
                                                        ? <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 text-[10px]">Sí</Badge>
                                                        : <Badge variant="secondary" className="text-[10px]">No</Badge>
                                                    }
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
    return (
        <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">{label}:</span>
            <span className="font-medium ml-auto text-right">{value}</span>
        </div>
    )
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent: string }) {
    const colorMap: Record<string, string> = {
        blue: 'bg-blue-50 text-blue-700',
        green: 'bg-emerald-50 text-emerald-700',
        emerald: 'bg-emerald-50 text-emerald-700',
        red: 'bg-red-50 text-red-700',
        amber: 'bg-amber-50 text-amber-700',
        purple: 'bg-purple-50 text-purple-700',
        slate: 'bg-slate-50 text-slate-700',
    }
    return (
        <div className={`rounded-lg p-3 ${colorMap[accent] || colorMap.slate}`}>
            <p className="text-[11px] font-medium opacity-70">{label}</p>
            <p className="font-bold text-lg mt-0.5">{value}</p>
        </div>
    )
}

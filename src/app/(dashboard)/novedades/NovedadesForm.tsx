'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { crearNovedad, buscarEmpleadoNombre } from './actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

// Tipos de novedades con metadata de comportamiento
const TIPOS_NOVEDAD = [
    // Domingos/Festivos
    { value: 'GANA_DOMINGO', label: 'Gana Domingo', grupo: 'Domingos/Festivos', requiereFechas: false },
    { value: 'NO_GANA_DOMINGO', label: 'No Gana Domingo', grupo: 'Domingos/Festivos', requiereFechas: false },
    { value: 'GANA_FESTIVO', label: 'Gana Festivo', grupo: 'Domingos/Festivos', requiereFechas: false },
    // Ausencias
    { value: 'AUSENTISMO', label: 'Ausentismo', grupo: 'Ausencias', requiereFechas: false },
    { value: 'PERMISO', label: 'Permiso', grupo: 'Ausencias', requiereFechas: false },
    { value: 'SANCION', label: 'Sanción', grupo: 'Ausencias', requiereFechas: true },
    // Incapacidades
    { value: 'INCAPACIDAD', label: 'Incapacidad', grupo: 'Incapacidades', requiereFechas: true, requiereCausa: true },
    { value: 'INCAPACIDAD_ARL', label: 'Incapacidad ARL', grupo: 'Incapacidades', requiereFechas: true, requiereCausa: true },
    // Licencias
    { value: 'LIC_NO_REMUNERADA', label: 'Lic. No Remunerada', grupo: 'Licencias', requiereFechas: true },
    { value: 'LIC_LUTO', label: 'Lic. de Luto', grupo: 'Licencias', requiereFechas: true },
    { value: 'LIC_MATERNIDAD', label: 'Lic. Maternidad', grupo: 'Licencias', requiereFechas: true },
    { value: 'LIC_REMUNERADA', label: 'Lic. Remunerada', grupo: 'Licencias', requiereFechas: true },
    // Dias especiales
    { value: 'DIA_CUMPLEANOS', label: 'Día Cumpleaños', grupo: 'Días Especiales', requiereFechas: false },
    { value: 'DIA_FAMILIA', label: 'Día Familia', grupo: 'Días Especiales', requiereFechas: false },
    { value: 'VACACIONES', label: 'Vacaciones', grupo: 'Días Especiales', requiereFechas: true },
    // Turnos
    { value: 'FIN_TURNO_NOCHE', label: 'Fin Turno Noche', grupo: 'Turnos', requiereFechas: false },
    { value: 'FIN_TURNO_DIA', label: 'Fin Turno Día', grupo: 'Turnos', requiereFechas: false },
    // Tiempo
    { value: 'COMPENSA_TIEMPO', label: 'Compensa Tiempo', grupo: 'Tiempo', requiereFechas: false },
    { value: 'PAGA_TIEMPO', label: 'Paga Tiempo', grupo: 'Tiempo', requiereFechas: false },
    // Movimientos
    { value: 'TRASLADO', label: 'Traslado', grupo: 'Movimientos', requiereFechas: false },
    { value: 'INGRESO_NUEVO', label: 'Ingreso Nuevo', grupo: 'Movimientos', requiereFechas: false },
    { value: 'RETIRO', label: 'Retiro', grupo: 'Movimientos', requiereFechas: false },
] as const

// Agrupar para el select
const grupos = [...new Set(TIPOS_NOVEDAD.map(t => t.grupo))]

interface NovedadesFormProps {
    rol?: 'admin' | 'coordinador'
}

export function NovedadesForm({ rol }: NovedadesFormProps) {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [cedula, setCedula] = useState('')
    const [nombre, setNombre] = useState('')
    const [tipoNovedad, setTipoNovedad] = useState('')
    const [remunerable, setRemunerable] = useState('false')
    const [causa, setCausa] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')

    const tipoConfig = TIPOS_NOVEDAD.find(t => t.value === tipoNovedad)
    const necesitaRangoFechas = tipoConfig?.requiereFechas ?? false
    const necesitaCausa = (tipoConfig as any)?.requiereCausa ?? false

    useEffect(() => {
        const fetchNombre = async () => {
            if (cedula.length >= 6) {
                const nombreEncontrado = await buscarEmpleadoNombre(cedula)
                setNombre(nombreEncontrado || '')
            } else {
                setNombre('')
            }
        }
        const timeoutId = setTimeout(fetchNombre, 500)
        return () => clearTimeout(timeoutId)
    }, [cedula])

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()

        if (!tipoNovedad) {
            toast.error('Seleccione el tipo de novedad.')
            return
        }

        if (necesitaRangoFechas && (!startDate || !endDate)) {
            toast.error('Complete el rango de fechas.')
            return
        }

        setIsLoading(true)
        const form = event.currentTarget as HTMLFormElement
        const formData = new FormData(form)
        formData.append('usuario_id', cedula)
        formData.append('tipo_novedad', tipoNovedad)
        formData.append('remunerable', remunerable)
        if (necesitaCausa) {
            formData.append('causa', causa)
        }

        const result = await crearNovedad(formData)

        setIsLoading(false)

        if (!result.success) {
            toast.error(result.error)
        } else {
            toast.success('Novedad registrada exitosamente')
            form.reset()
            setCedula('')
            setNombre('')
            setTipoNovedad('')
            setRemunerable('false')
            setCausa('')
            setStartDate('')
            setEndDate('')
            router.refresh()
        }
    }

    return (
        <Card className="shadow-sm">
            <CardHeader>
                <CardTitle className="text-xl">Nueva Novedad</CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="cedula">Cédula del Empleado *</Label>
                        <Input
                            id="cedula"
                            name="cedula"
                            value={cedula}
                            onChange={(e) => setCedula(e.target.value)}
                            required
                            placeholder="Ingrese la cédula"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="nombre">Nombre del Empleado</Label>
                        <Input
                            id="nombre"
                            name="nombre"
                            value={nombre}
                            readOnly
                            className="bg-slate-50 cursor-not-allowed"
                            placeholder="Se autocompletará"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="tipoNovedad">Tipo de Novedad *</Label>
                        <Select value={tipoNovedad} onValueChange={setTipoNovedad}>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccione un tipo..." />
                            </SelectTrigger>
                            <SelectContent>
                                {grupos.map(grupo => (
                                    <div key={grupo}>
                                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{grupo}</div>
                                        {TIPOS_NOVEDAD.filter(t => t.grupo === grupo).map(t => (
                                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                        ))}
                                    </div>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Fecha unica para tipos sin rango */}
                    {tipoNovedad && !necesitaRangoFechas && (
                        <div className="space-y-2">
                            <Label htmlFor="fechaNovedad">Fecha de la Novedad *</Label>
                            <Input type="date" id="fechaNovedad" name="fechaNovedad" required />
                        </div>
                    )}

                    {/* Rango de fechas para incapacidades, licencias, vacaciones, etc */}
                    {necesitaRangoFechas && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="startDate">Fecha Inicio *</Label>
                                <Input type="date" id="startDate" name="startDate" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="endDate">Fecha Fin *</Label>
                                <Input type="date" id="endDate" name="endDate" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="razon">Observaciones</Label>
                        <Textarea id="razon" name="razon" placeholder="Describa la razón o justificación..." rows={2} />
                    </div>

                    {/* Causa EPS solo para incapacidades */}
                    {necesitaCausa && (
                        <div className="space-y-2">
                            <Label htmlFor="causa">Causa (EPS)</Label>
                            <Select value={causa} onValueChange={setCausa}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccione causa..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">1 - Licencia Remunerada</SelectItem>
                                    <SelectItem value="3">3 - Maternidad/Paternidad</SelectItem>
                                    <SelectItem value="4">4 - Enfermedad General</SelectItem>
                                    <SelectItem value="5">5 - Enfermedad Profesional</SelectItem>
                                    <SelectItem value="6">6 - Accidente de Trabajo</SelectItem>
                                    <SelectItem value="10">10 - Cita Médica</SelectItem>
                                    <SelectItem value="14">14 - Calamidad</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Valor monetario (opcional, para cualquier tipo) */}
                    <div className="space-y-2">
                        <Label htmlFor="valor_monetario">Valor Monetario (COP)</Label>
                        <Input type="number" id="valor_monetario" name="valor_monetario" placeholder="Opcional" min="0" />
                    </div>

                    <div className="space-y-2">
                        <Label>¿Es remunerable?</Label>
                        <Select value={remunerable} onValueChange={setRemunerable}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="true">Sí</SelectItem>
                                <SelectItem value="false">No</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={isLoading || !nombre}>
                        {isLoading ? 'Guardando...' : 'Registrar Novedad'}
                    </Button>
                </form>
            </CardContent>
        </Card>
    )
}

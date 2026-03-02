'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { crearNovedad, buscarEmpleadoNombre } from './actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export function NovedadesForm() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [cedula, setCedula] = useState('')
    const [nombre, setNombre] = useState('')
    const [tipoNovedad, setTipoNovedad] = useState('')
    const [remunerable, setRemunerable] = useState('')
    const [causa, setCausa] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')

    // Fetch the employee name automatically
    useEffect(() => {
        const fetchNombre = async () => {
            if (cedula.length >= 6) {
                const nombreEncontrado = await buscarEmpleadoNombre(cedula)
                if (nombreEncontrado) {
                    setNombre(nombreEncontrado)
                } else {
                    setNombre('')
                }
            } else {
                setNombre('')
            }
        }

        const timeoutId = setTimeout(() => {
            fetchNombre()
        }, 500) // debounce
        return () => clearTimeout(timeoutId)
    }, [cedula])

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()

        if (!tipoNovedad) {
            toast.error('Seleccione el tipo de novedad.')
            return
        }

        if (tipoNovedad === 'incapacidad' && (!startDate || !endDate)) {
            toast.error('Complete el rango de fechas de la incapacidad.')
            return
        }

        setIsLoading(true)
        const form = event.currentTarget as HTMLFormElement
        const formData = new FormData(form)
        formData.append('usuario_id', cedula)
        formData.append('tipo_novedad', tipoNovedad)
        formData.append('remunerable', remunerable)
        if (tipoNovedad === 'incapacidad') {
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
            setRemunerable('')
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
                        <Label htmlFor="nombre">Nombre del Empleado *</Label>
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
                                <SelectItem value="auxilio_no_prestacional">Auxilio No Prestacional / Deducción</SelectItem>
                                <SelectItem value="incapacidad">Incapacidad (Licencias, Ausencias)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {tipoNovedad !== 'incapacidad' && (
                        <div className="space-y-2">
                            <Label htmlFor="fechaNovedad">Fecha de la Novedad *</Label>
                            <Input
                                type="date"
                                id="fechaNovedad"
                                name="fechaNovedad"
                                required={tipoNovedad !== 'incapacidad'}
                            />
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="razon">Razón / Justificación *</Label>
                        <Textarea
                            id="razon"
                            name="razon"
                            required
                            placeholder="Describa la razón principal..."
                            rows={3}
                        />
                    </div>

                    {tipoNovedad === 'auxilio_no_prestacional' && (
                        <div className="space-y-4 pt-2 border-t mt-4">
                            <div className="space-y-2">
                                <Label htmlFor="valor_monetario">Valor Monetario (COP) *</Label>
                                <Input
                                    type="number"
                                    id="valor_monetario"
                                    name="valor_monetario"
                                    placeholder="Ingrese el valor"
                                    min="0"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="remunerable">¿Afecta pagos de planilla directamente? *</Label>
                                <Select value={remunerable} onValueChange={setRemunerable}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccione..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="true">Sí (Remunerado / Deducción Aplicada)</SelectItem>
                                        <SelectItem value="false">No (Informativo)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}

                    {tipoNovedad === 'incapacidad' && (
                        <div className="space-y-4 pt-2 border-t mt-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="startDate">Fecha Inicio *</Label>
                                    <Input
                                        type="date"
                                        id="startDate"
                                        name="startDate"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="endDate">Fecha Fin *</Label>
                                    <Input
                                        type="date"
                                        id="endDate"
                                        name="endDate"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="causa">Causa (Opcional - EPS)</Label>
                                <Select value={causa} onValueChange={setCausa}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccione una causa..." />
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
                        </div>
                    )}

                    <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={isLoading || !nombre}>
                        {isLoading ? 'Guardando...' : 'Registrar Novedad'}
                    </Button>
                </form>
            </CardContent>
        </Card>
    )
}

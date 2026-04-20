'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { crearEmpleado } from './actions'
import { getTurnosPorNombreOperacion } from '../admin/operaciones-actions'
import type { Turno } from '../admin/operaciones-actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export function EmpleadoForm({
    operaciones,
    rol,
    operacionFija
}: {
    operaciones: { id: string, nombre: string }[]
    rol: string
    operacionFija: string | null
}) {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)

    const isCoordinador = rol === 'coordinador' && !!operacionFija

    const [birthdate, setBirthdate] = useState('')
    const [operacion, setOperacion] = useState(isCoordinador ? operacionFija : '')
    const [turnoId, setTurnoId] = useState('')
    const [turnos, setTurnos] = useState<Turno[]>([])
    const [turnosLoading, setTurnosLoading] = useState(false)

    // Límites razonables para la fecha de nacimiento: entre hace 100 años y hace 16 (edad mínima laboral CO)
    const hoy = new Date()
    const maxDate = new Date(hoy.getFullYear() - 16, hoy.getMonth(), hoy.getDate()).toISOString().slice(0, 10)
    const minDate = new Date(hoy.getFullYear() - 100, hoy.getMonth(), hoy.getDate()).toISOString().slice(0, 10)

    // Cargar turnos cuando cambia la operacion
    useEffect(() => {
        if (!operacion) {
            setTurnos([])
            setTurnoId('')
            return
        }

        setTurnosLoading(true)
        getTurnosPorNombreOperacion(operacion).then(res => {
            if (res.success && res.data) {
                setTurnos(res.data)
            } else {
                setTurnos([])
            }
            setTurnoId('')
            setTurnosLoading(false)
        })
    }, [operacion])

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()

        if (!birthdate) {
            toast.error('Ingresá la fecha de nacimiento.')
            return
        }
        if (!operacion) {
            toast.error('Seleccioná una operación.')
            return
        }

        setIsLoading(true)
        const form = event.currentTarget as HTMLFormElement
        const formData = new FormData(form)
        formData.append('birthdate', birthdate)
        formData.append('operacion', operacion)
        if (turnoId) formData.append('turno_id', turnoId)

        const result = await crearEmpleado(formData)

        setIsLoading(false)

        if (!result.success) {
            toast.error(result.error)
        } else {
            toast.success('Empleado registrado exitosamente.')
            form.reset()
            setBirthdate('')
            setOperacion(isCoordinador ? operacionFija : '')
            setTurnoId('')
            router.refresh()
        }
    }

    return (
        <Card className="shadow-sm">
            <CardHeader>
                <CardTitle className="text-xl">Agregar Nuevo Empleado</CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="cedula">Cédula *</Label>
                        <Input id="cedula" name="cedula" required placeholder="Ingrese la cédula" />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="nombre">Nombre Completo *</Label>
                        <Input id="nombre" name="nombre" required placeholder="Ingrese el nombre completo" />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="cargo">Cargo *</Label>
                        <Input id="cargo" name="cargo" required placeholder="Ej. Operario" />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="birthdate">Fecha de Nacimiento *</Label>
                        <Input
                            id="birthdate"
                            type="date"
                            value={birthdate}
                            onChange={(e) => setBirthdate(e.target.value)}
                            min={minDate}
                            max={maxDate}
                            required
                        />
                        <p className="text-xs text-slate-500">Edad mínima: 16 años.</p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="operacion">Operación *</Label>
                        <Select value={operacion} onValueChange={setOperacion} disabled={isCoordinador}>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccione una operación..." />
                            </SelectTrigger>
                            <SelectContent>
                                {operaciones.map(op => (
                                    <SelectItem key={op.id} value={op.nombre}>{op.nombre}</SelectItem>
                                ))}
                                {operaciones.length === 0 && <SelectItem value="default" disabled>No hay operaciones activas</SelectItem>}
                            </SelectContent>
                        </Select>
                    </div>

                    {operacion && (
                        <div className="space-y-2">
                            <Label htmlFor="turno">Turno Asignado</Label>
                            {turnosLoading ? (
                                <p className="text-sm text-muted-foreground">Cargando turnos...</p>
                            ) : turnos.length > 0 ? (
                                <Select value={turnoId} onValueChange={setTurnoId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccione un turno..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {turnos.map(t => (
                                            <SelectItem key={t.id} value={t.id}>
                                                {t.nombre} ({t.hora_inicio.slice(0, 5)} — {t.hora_fin.slice(0, 5)})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <p className="text-sm text-muted-foreground">No hay turnos configurados para esta operación</p>
                            )}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="salario">Salario Mensual</Label>
                        <Input
                            id="salario"
                            name="salario"
                            type="number"
                            placeholder="Ej. 1300000"
                            min="0"
                        />
                    </div>

                    <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
                        {isLoading ? 'Guardando...' : 'Agregar Usuario'}
                    </Button>
                </form>
            </CardContent>
        </Card>
    )
}

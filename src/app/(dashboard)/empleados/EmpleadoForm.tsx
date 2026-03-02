'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { crearEmpleado } from './actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export function EmpleadoForm() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)

    // Select values
    const [dia, setDia] = useState('')
    const [mes, setMes] = useState('')
    const [anio, setAnio] = useState('')
    const [operacion, setOperacion] = useState('')

    const dias = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'))
    const meses = [
        { label: 'Enero', val: '01' }, { label: 'Febrero', val: '02' }, { label: 'Marzo', val: '03' },
        { label: 'Abril', val: '04' }, { label: 'Mayo', val: '05' }, { label: 'Junio', val: '06' },
        { label: 'Julio', val: '07' }, { label: 'Agosto', val: '08' }, { label: 'Septiembre', val: '09' },
        { label: 'Octubre', val: '10' }, { label: 'Noviembre', val: '11' }, { label: 'Diciembre', val: '12' }
    ]
    const currentYear = new Date().getFullYear()
    const anios = Array.from({ length: 100 }, (_, i) => String(currentYear - i))

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()

        if (!dia || !mes || !anio) {
            toast.error('Seleccione la fecha de nacimiento completa')
            return
        }

        if (!operacion) {
            toast.error('Seleccione una operación')
            return
        }

        setIsLoading(true)
        const form = event.currentTarget as HTMLFormElement
        const formData = new FormData(form)
        const birthdate = `${anio}-${mes}-${dia}`
        formData.append('birthdate', birthdate)
        formData.append('operacion', operacion)

        const result = await crearEmpleado(formData)

        setIsLoading(false)

        if (!result.success) {
            toast.error(result.error)
        } else {
            toast.success('Empleado registrado exitosamente')
            form.reset()
            setDia('')
            setMes('')
            setAnio('')
            setOperacion('')
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
                        <Label>Fecha de Nacimiento *</Label>
                        <div className="grid grid-cols-3 gap-2">
                            <Select value={dia} onValueChange={setDia}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Día" />
                                </SelectTrigger>
                                <SelectContent>
                                    {dias.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                </SelectContent>
                            </Select>

                            <Select value={mes} onValueChange={setMes}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Mes" />
                                </SelectTrigger>
                                <SelectContent>
                                    {meses.map(m => <SelectItem key={m.val} value={m.val}>{m.label}</SelectItem>)}
                                </SelectContent>
                            </Select>

                            <Select value={anio} onValueChange={setAnio}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Año" />
                                </SelectTrigger>
                                <SelectContent>
                                    {anios.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="operacion">Operación *</Label>
                        <Select value={operacion} onValueChange={setOperacion}>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccione una operación..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Multidimensionales">Multidimensionales</SelectItem>
                                <SelectItem value="Red polar">Red polar</SelectItem>
                                <SelectItem value="Frigorifico">Frigorifico</SelectItem>
                                <SelectItem value="Alkosto">Alkosto</SelectItem>
                                <SelectItem value="Pepsico funza">Pepsico funza</SelectItem>
                                <SelectItem value="Pepsico maquila">Pepsico maquila</SelectItem>
                                <SelectItem value="Pepsico 3pd">Pepsico 3pd</SelectItem>
                                <SelectItem value="materia prima B9">materia prima B9</SelectItem>
                                <SelectItem value="Administrativo J3">Administrativo J3</SelectItem>
                                <SelectItem value="Administrativo B9">Administrativo B9</SelectItem>
                                <SelectItem value="Giron">Giron</SelectItem>
                                <SelectItem value="Buga">Buga</SelectItem>
                                <SelectItem value="Pepsico Bucaramanga">Pepsico Bucaramanga</SelectItem>
                                <SelectItem value="Pepsico Barranquilla">Pepsico Barranquilla</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
                        {isLoading ? 'Guardando...' : 'Agregar Usuario'}
                    </Button>
                </form>
            </CardContent>
        </Card>
    )
}

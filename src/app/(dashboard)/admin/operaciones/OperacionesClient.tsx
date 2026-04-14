'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
    Operacion, Turno,
    upsertOperacion, deleteOperacion,
    getTurnosPorOperacion, crearTurno, editarTurno, eliminarTurno
} from '../operaciones-actions'
import { Plus, Edit2, Trash2, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'

export function OperacionesClient({ initialData }: { initialData: Operacion[] }) {
    const router = useRouter()

    const [openModal, setOpenModal] = useState(false)
    const [loading, setLoading] = useState(false)
    const [form, setForm] = useState<Partial<Operacion>>({})

    // Turnos state
    const [turnosModal, setTurnosModal] = useState<string | null>(null) // operacion_id
    const [turnosModalNombre, setTurnosModalNombre] = useState('')
    const [turnos, setTurnos] = useState<Turno[]>([])
    const [turnoForm, setTurnoForm] = useState<{ nombre: string; hora_inicio: string; hora_fin: string }>({ nombre: '', hora_inicio: '', hora_fin: '' })
    const [editingTurnoId, setEditingTurnoId] = useState<string | null>(null)
    const [turnosLoading, setTurnosLoading] = useState(false)

    const handleOpenModal = (op?: Operacion) => {
        if (op) {
            setForm({ ...op })
        } else {
            setForm({ nombre: '', status: true })
        }
        setOpenModal(true)
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.nombre?.trim()) return toast.error('El nombre es obligatorio')

        setLoading(true)
        const { success, error } = await upsertOperacion(form)
        if (success) {
            toast.success(form.id ? 'Operación actualizada' : 'Operación creada')
            setOpenModal(false)
            router.refresh()
        } else {
            toast.error(error || 'Error al guardar')
        }
        setLoading(false)
    }

    const handleDelete = async (id: string, nombre: string) => {
        if (!confirm(`¿Deseas eliminar permanentemente la operación "${nombre}"?`)) return

        const toastId = toast.loading('Eliminando...')
        const { success, error } = await deleteOperacion(id)
        if (success) {
            toast.success('Eliminada con éxito', { id: toastId })
            router.refresh()
        } else {
            toast.error(error || 'Hubo un error', { id: toastId })
        }
    }

    // Turnos handlers
    const openTurnosModal = async (op: Operacion) => {
        setTurnosModal(op.id)
        setTurnosModalNombre(op.nombre)
        setTurnosLoading(true)
        const res = await getTurnosPorOperacion(op.id)
        if (res.success && res.data) {
            setTurnos(res.data)
        } else {
            setTurnos([])
        }
        setTurnosLoading(false)
    }

    const resetTurnoForm = () => {
        setTurnoForm({ nombre: '', hora_inicio: '', hora_fin: '' })
        setEditingTurnoId(null)
    }

    const handleSaveTurno = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!turnoForm.nombre.trim() || !turnoForm.hora_inicio || !turnoForm.hora_fin) {
            return toast.error('Todos los campos del turno son obligatorios')
        }

        setTurnosLoading(true)
        let result

        if (editingTurnoId) {
            result = await editarTurno(editingTurnoId, turnoForm)
        } else {
            result = await crearTurno({ operacion_id: turnosModal!, ...turnoForm })
        }

        if (result.success) {
            toast.success(editingTurnoId ? 'Turno actualizado' : 'Turno creado')
            resetTurnoForm()
            // Refrescar turnos
            const res = await getTurnosPorOperacion(turnosModal!)
            if (res.success && res.data) setTurnos(res.data)
        } else {
            toast.error(result.error || 'Error al guardar turno')
        }
        setTurnosLoading(false)
    }

    const handleEditTurno = (turno: Turno) => {
        setEditingTurnoId(turno.id)
        setTurnoForm({
            nombre: turno.nombre,
            hora_inicio: turno.hora_inicio.slice(0, 5), // HH:MM
            hora_fin: turno.hora_fin.slice(0, 5)
        })
    }

    const handleDeleteTurno = async (id: string, nombre: string) => {
        if (!confirm(`¿Eliminar el turno "${nombre}"?`)) return
        const result = await eliminarTurno(id)
        if (result.success) {
            toast.success('Turno eliminado')
            setTurnos(prev => prev.filter(t => t.id !== id))
        } else {
            toast.error(result.error || 'Error al eliminar turno')
        }
    }

    return (
        <Card className="shadow-sm">
            <CardContent className="p-0">
                <div className="flex justify-between p-4 border-b bg-slate-50/50">
                    <Input placeholder="Buscar operación..." className="max-w-xs" disabled />
                    <Button onClick={() => handleOpenModal()} className="gap-2 shrink-0">
                        <Plus className="h-4 w-4" />
                        Nueva Operación
                    </Button>
                </div>

                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50">
                                <TableHead>Nombre de la Operación</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead>Fecha Creación</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {initialData.map((op) => (
                                <TableRow key={op.id}>
                                    <TableCell className="font-medium">{op.nombre}</TableCell>
                                    <TableCell>
                                        {op.status ? (
                                            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
                                                Activa
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary" className="bg-slate-100 text-slate-800">
                                                Inactiva
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {op.created_at ? new Date(op.created_at).toLocaleDateString() : '-'}
                                    </TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button variant="outline" size="sm" onClick={() => openTurnosModal(op)} title="Gestionar turnos">
                                            <Clock className="h-4 w-4 text-purple-600" />
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={() => handleOpenModal(op)}>
                                            <Edit2 className="h-4 w-4 text-blue-600" />
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={() => handleDelete(op.id, op.nombre)}>
                                            <Trash2 className="h-4 w-4 text-red-600" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}

                            {initialData.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                        No hay operaciones configuradas
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>

            {/* Modal: Crear/Editar Operación */}
            <Dialog open={openModal} onOpenChange={setOpenModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{form.id ? 'Editar Operación' : 'Nueva Operación'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSave} className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Nombre</label>
                            <Input
                                autoFocus
                                required
                                value={form.nombre || ''}
                                onChange={e => setForm({ ...form, nombre: e.target.value })}
                                placeholder="Ej. Bodega Central"
                            />
                        </div>
                        <div className="space-y-2 flex items-center justify-between">
                            <label className="text-sm font-medium">Estado (Activo vs Inactivo)</label>
                            <Button
                                type="button"
                                variant={form.status ? 'default' : 'outline'}
                                className={form.status ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                                onClick={() => setForm({ ...form, status: !form.status })}
                            >
                                {form.status ? 'Activo' : 'Inactivo'}
                            </Button>
                        </div>

                        <div className="pt-4 flex justify-end gap-2">
                            <Button type="button" variant="ghost" onClick={() => setOpenModal(false)} disabled={loading}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={loading}>
                                {loading ? 'Guardando...' : 'Guardar'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Modal: Gestión de Turnos */}
            <Dialog open={!!turnosModal} onOpenChange={(open) => { if (!open) { setTurnosModal(null); resetTurnoForm() } }}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Turnos — {turnosModalNombre}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 pt-2">
                        {/* Formulario para agregar/editar turno */}
                        <form onSubmit={handleSaveTurno} className="space-y-3 p-3 border rounded-lg bg-slate-50">
                            <p className="text-sm font-medium text-slate-700">
                                {editingTurnoId ? 'Editar turno' : 'Agregar turno'}
                            </p>
                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <Label className="text-xs">Nombre</Label>
                                    <Input
                                        placeholder="Ej. Mañana"
                                        value={turnoForm.nombre}
                                        onChange={e => setTurnoForm({ ...turnoForm, nombre: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs">Hora Inicio</Label>
                                    <Input
                                        type="time"
                                        value={turnoForm.hora_inicio}
                                        onChange={e => setTurnoForm({ ...turnoForm, hora_inicio: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs">Hora Fin</Label>
                                    <Input
                                        type="time"
                                        value={turnoForm.hora_fin}
                                        onChange={e => setTurnoForm({ ...turnoForm, hora_fin: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button type="submit" size="sm" disabled={turnosLoading}>
                                    {editingTurnoId ? 'Actualizar' : 'Agregar'}
                                </Button>
                                {editingTurnoId && (
                                    <Button type="button" size="sm" variant="ghost" onClick={resetTurnoForm}>
                                        Cancelar
                                    </Button>
                                )}
                            </div>
                        </form>

                        {/* Lista de turnos existentes */}
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Turno</TableHead>
                                        <TableHead>Horario</TableHead>
                                        <TableHead className="text-right">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {turnos.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center py-4 text-muted-foreground text-sm">
                                                {turnosLoading ? 'Cargando...' : 'No hay turnos configurados'}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {turnos.map(turno => (
                                        <TableRow key={turno.id}>
                                            <TableCell className="font-medium text-sm">{turno.nombre}</TableCell>
                                            <TableCell className="text-sm">
                                                {turno.hora_inicio.slice(0, 5)} — {turno.hora_fin.slice(0, 5)}
                                            </TableCell>
                                            <TableCell className="text-right space-x-1">
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditTurno(turno)}>
                                                    <Edit2 className="h-3 w-3 text-blue-600" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteTurno(turno.id, turno.nombre)}>
                                                    <Trash2 className="h-3 w-3 text-red-600" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </Card>
    )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Operacion, upsertOperacion, deleteOperacion } from '../operaciones-actions'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
            // Recargar datos desde server component
            router.refresh()
            // Si quieres optimista:
            // setData(prev => ...)
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
        </Card>
    )
}

'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react'
import { aprobarExtras, rechazarExtras, corregirInconsistente } from './actions'

function minutosAHoras(min: number) {
    const h = Math.floor(min / 60)
    const m = min % 60
    return `${h}h ${m}m`
}

// ─── PANEL DE EXTRAS ────────────────────────────────────────────────────────

interface Aprobacion {
    id: string
    minutos_solicitados: number
    estado: string
    created_at: string
    empleado_id: string
    jornada_id: string
    jornadas: { entrada: string; salida: string | null; operacion: string; minutos_total: number } | null
    usuarios: { nombre: string; operacion: string } | null
}

export function AprobacionesPanel({ aprobaciones }: { aprobaciones: Aprobacion[] }) {
    const [nota, setNota] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState<Record<string, boolean>>({})

    const handleAprobar = async (id: string) => {
        setLoading(prev => ({ ...prev, [id]: true }))
        const res = await aprobarExtras(id, nota[id])
        setLoading(prev => ({ ...prev, [id]: false }))
        if (res.success) toast.success('Horas extra aprobadas.')
        else toast.error(res.error)
    }

    const handleRechazar = async (id: string) => {
        if (!nota[id]?.trim()) { toast.error('Agregá una nota de rechazo.'); return }
        setLoading(prev => ({ ...prev, [id]: true }))
        const res = await rechazarExtras(id, nota[id])
        setLoading(prev => ({ ...prev, [id]: false }))
        if (res.success) toast.success('Horas extra rechazadas.')
        else toast.error(res.error)
    }

    if (aprobaciones.length === 0) {
        return (
            <div className="text-center py-12 text-slate-500">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-400" />
                <p className="font-medium">No hay extras pendientes de aprobación.</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {aprobaciones.map(ap => {
                const entradaDate = ap.jornadas?.entrada ? new Date(ap.jornadas.entrada) : null
                const salidaDate = ap.jornadas?.salida ? new Date(ap.jornadas.salida) : null
                return (
                    <div key={ap.id} className="border rounded-lg p-4 bg-white space-y-3">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="font-semibold text-slate-800">
                                    {ap.usuarios?.nombre ?? ap.empleado_id}
                                </p>
                                <p className="text-sm text-slate-500">{ap.jornadas?.operacion}</p>
                            </div>
                            <Badge variant="outline" className="text-amber-600 border-amber-400 bg-amber-50 whitespace-nowrap">
                                <Clock className="w-3 h-3 mr-1" />
                                {minutosAHoras(ap.minutos_solicitados)} extra
                            </Badge>
                        </div>
                        {entradaDate && (
                            <p className="text-xs text-slate-400">
                                Jornada: {entradaDate.toLocaleDateString('es-CO')} — {entradaDate.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                                {salidaDate && ` → ${salidaDate.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`}
                                {ap.jornadas?.minutos_total ? ` (${minutosAHoras(ap.jornadas.minutos_total)} totales)` : ''}
                            </p>
                        )}
                        <Textarea
                            placeholder="Nota (opcional para aprobar, obligatoria para rechazar)"
                            value={nota[ap.id] ?? ''}
                            onChange={e => setNota(prev => ({ ...prev, [ap.id]: e.target.value }))}
                            rows={2}
                            className="text-sm"
                        />
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 gap-1"
                                disabled={loading[ap.id]}
                                onClick={() => handleAprobar(ap.id)}
                            >
                                <CheckCircle2 className="w-4 h-4" /> Aprobar
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                className="border-red-400 text-red-600 hover:bg-red-50 gap-1"
                                disabled={loading[ap.id]}
                                onClick={() => handleRechazar(ap.id)}
                            >
                                <XCircle className="w-4 h-4" /> Rechazar
                            </Button>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

// ─── PANEL DE INCONSISTENTES ─────────────────────────────────────────────────

interface Inconsistente {
    id: string
    empleado_id: string
    operacion: string
    entrada: string
    usuarios: { nombre: string } | null
}

export function InconsistentesPanel({ jornadas }: { jornadas: Inconsistente[] }) {
    const [horaSalida, setHoraSalida] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState<Record<string, boolean>>({})

    const handleCorregir = async (id: string, entrada: string) => {
        if (!horaSalida[id]) { toast.error('Ingresá la hora de salida real.'); return }

        // Construir timestamp: misma fecha de la entrada + hora ingresada
        const fechaEntrada = new Date(entrada)
        const [hh, mm] = horaSalida[id].split(':').map(Number)
        const salidaDate = new Date(fechaEntrada)
        salidaDate.setUTCHours(hh + 5, mm, 0, 0) // +5 para pasar de Bogotá a UTC

        // Si la hora de salida es menor que la de entrada, asumimos que cruzó medianoche
        if (salidaDate <= fechaEntrada) salidaDate.setUTCDate(salidaDate.getUTCDate() + 1)

        setLoading(prev => ({ ...prev, [id]: true }))
        const res = await corregirInconsistente(id, salidaDate.toISOString())
        setLoading(prev => ({ ...prev, [id]: false }))
        if (res.success) toast.success('Jornada corregida y horas recalculadas.')
        else toast.error(res.error ?? 'Error al corregir')
    }

    if (jornadas.length === 0) {
        return (
            <div className="text-center py-12 text-slate-500">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-400" />
                <p className="font-medium">No hay jornadas inconsistentes.</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {jornadas.map(j => {
                const entradaDate = new Date(j.entrada)
                const entradaBogota = new Date(entradaDate.getTime() - 5 * 60 * 60 * 1000)
                return (
                    <div key={j.id} className="border border-red-200 rounded-lg p-4 bg-red-50 space-y-3">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="font-semibold text-slate-800">
                                    {j.usuarios?.nombre ?? j.empleado_id}
                                </p>
                                <p className="text-sm text-slate-500">{j.operacion}</p>
                            </div>
                            <Badge variant="destructive" className="whitespace-nowrap">
                                <AlertTriangle className="w-3 h-3 mr-1" /> Inconsistente
                            </Badge>
                        </div>
                        <p className="text-sm text-slate-600">
                            Entrada: {entradaBogota.toLocaleDateString('es-CO')} a las{' '}
                            {entradaBogota.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })} (Bogotá)
                        </p>
                        <div className="flex items-center gap-3">
                            <div className="flex-1">
                                <label className="text-xs text-slate-600 mb-1 block">Hora de salida real (Bogotá)</label>
                                <Input
                                    type="time"
                                    value={horaSalida[j.id] ?? ''}
                                    onChange={e => setHoraSalida(prev => ({ ...prev, [j.id]: e.target.value }))}
                                    className="bg-white"
                                />
                            </div>
                            <Button
                                size="sm"
                                className="mt-5 bg-blue-600 hover:bg-blue-700"
                                disabled={loading[j.id]}
                                onClick={() => handleCorregir(j.id, j.entrada)}
                            >
                                Corregir
                            </Button>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

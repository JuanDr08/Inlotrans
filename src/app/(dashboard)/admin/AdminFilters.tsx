'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { getOperacionesActivas } from './operaciones-actions'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const ANIOS = [2024, 2025, 2026]

export function AdminFilters() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const [isLoading, setIsLoading] = useState(false)

    // Valores iniciales
    const now = new Date()
    const [mes, setMes] = useState(searchParams.get('mes') || now.getMonth().toString())
    const [anio, setAnio] = useState(searchParams.get('anio') || now.getFullYear().toString())
    const [periodo, setPeriodo] = useState(searchParams.get('periodo') || 'quincenal')

    const [start, setStart] = useState(searchParams.get('start') || '')
    const [end, setEnd] = useState(searchParams.get('end') || '')

    const [operacionesSeleccionadas, setOperacionesSeleccionadas] = useState<string[]>(
        searchParams.get('op') ? searchParams.get('op')!.split(',') : []
    )
    const [listaOperaciones, setListaOperaciones] = useState<{ id: string, nombre: string }[]>([])

    useEffect(() => {
        async function fetchOps() {
            const res = await getOperacionesActivas()
            if (res.success && res.data) {
                setListaOperaciones(res.data)
            }
        }
        fetchOps()
    }, [])

    const toggleOperacion = (opNombre: string) => {
        setOperacionesSeleccionadas(prev =>
            prev.includes(opNombre)
                ? prev.filter(o => o !== opNombre)
                : [...prev, opNombre]
        )
    }

    const handleApply = () => {
        setIsLoading(true)
        const params = new URLSearchParams()

        params.set('mes', mes)
        params.set('anio', anio)
        params.set('periodo', periodo)

        if (periodo === 'personalizado') {
            if (start) params.set('start', start)
            if (end) params.set('end', end)
        }

        if (operacionesSeleccionadas.length > 0) {
            params.set('op', operacionesSeleccionadas.join(','))
        }

        router.push(`?${params.toString()}`)
        setIsLoading(false)
    }

    const handleReset = () => {
        setIsLoading(true)
        setMes(now.getMonth().toString())
        setAnio(now.getFullYear().toString())
        setPeriodo('quincenal')
        setStart('')
        setEnd('')
        setOperacionesSeleccionadas([])
        router.push(`?`)
        setIsLoading(false)
    }

    return (
        <div className="flex flex-col gap-4 mb-6 p-4 bg-white rounded-lg border shadow-sm">
            <div className="flex flex-wrap gap-4 items-end">
                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-slate-700">Mes:</label>
                    <select
                        value={mes}
                        onChange={(e) => setMes(e.target.value)}
                        className="h-10 px-3 py-2 bg-white border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                        disabled={periodo === 'personalizado'}
                    >
                        {MESES.map((m, i) => (
                            <option key={i} value={i}>{m}</option>
                        ))}
                    </select>
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-slate-700">Año:</label>
                    <select
                        value={anio}
                        onChange={(e) => setAnio(e.target.value)}
                        className="h-10 px-3 py-2 bg-white border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                        disabled={periodo === 'personalizado'}
                    >
                        {ANIOS.map((a) => (
                            <option key={a} value={a}>{a}</option>
                        ))}
                    </select>
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-slate-700">Período:</label>
                    <select
                        value={periodo}
                        onChange={(e) => setPeriodo(e.target.value)}
                        className="h-10 px-3 py-2 bg-white border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                    >
                        <option value="quincenal">Quincenal (Agrupado)</option>
                        <option value="semanal">Semanal (Agrupado)</option>
                        <option value="mensual">Mensual (Consolidado)</option>
                        <option value="personalizado">Rango Personalizado</option>
                    </select>
                </div>

                {periodo === 'personalizado' && (
                    <div className="flex gap-2 items-end bg-slate-50 p-2 rounded-md border">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-slate-600">Desde:</label>
                            <input
                                type="date"
                                value={start}
                                onChange={(e) => setStart(e.target.value)}
                                className="h-8 px-2 border rounded text-sm"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-slate-600">Hasta:</label>
                            <input
                                type="date"
                                value={end}
                                onChange={(e) => setEnd(e.target.value)}
                                className="h-8 px-2 border rounded text-sm"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Selector Múltiple de Operaciones */}
            <div className="pt-2 border-t mt-2">
                <label className="text-sm font-medium text-slate-700 mb-2 block">Filtrar por Operaciones:</label>
                <div className="flex flex-wrap gap-2">
                    {listaOperaciones.map(op => {
                        const isSelected = operacionesSeleccionadas.includes(op.nombre)
                        return (
                            <button
                                key={op.id}
                                onClick={() => toggleOperacion(op.nombre)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${isSelected
                                        ? 'bg-blue-100 text-blue-800 border-blue-200'
                                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                    }`}
                            >
                                {op.nombre}
                            </button>
                        )
                    })}
                    {listaOperaciones.length === 0 && (
                        <span className="text-xs text-slate-400">Cargando operaciones...</span>
                    )}
                </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
                <Button
                    variant="outline"
                    onClick={handleReset}
                    disabled={isLoading}
                >
                    Restablecer
                </Button>
                <Button
                    variant="default"
                    onClick={handleApply}
                    disabled={isLoading}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                    {isLoading ? 'Calculando...' : 'Aplicar Filtros'}
                </Button>
            </div>
        </div >
    )
}

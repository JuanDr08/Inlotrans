'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Download, FileSpreadsheet, Loader2, FileDown } from 'lucide-react'
import { toast } from 'sonner'
import { useSearchParams } from 'next/navigation'

export function AdminExcelButton() {
    const [exportingType, setExportingType] = useState<string | null>(null)
    const [quincena, setQuincena] = useState<string>('1Q')
    const searchParams = useSearchParams()

    const handleExport = async (type: string, isPlano: boolean = false) => {
        try {
            setExportingType(type)

            const params = new URLSearchParams(searchParams.toString())

            // Si el usuario no ha presionado "Aplicar Filtros", los params estarán vacíos. 
            // Inyectamos los valores por defecto actuales (mes actual, año actual, periodo quincenal)
            if (!params.has('mes')) {
                params.set('mes', new Date().getMonth().toString())
            }
            if (!params.has('anio')) {
                params.set('anio', new Date().getFullYear().toString())
            }
            if (!params.has('periodo')) {
                params.set('periodo', 'quincenal')
            }

            let url = ''

            if (isPlano) {
                params.set('tipoPlan', type)
                params.set('quincena', quincena)
                url = `/api/exportar-planos?${params.toString()}`
            } else {
                url = `/api/exportar-excel?${params.toString()}`
            }

            window.location.href = url
            toast.success("Descarga iniciada", { description: "Revisa tus descargas en breve" })

        } catch (error) {
            console.error(error)
            toast.error("Ocurrió un error al exportar")
        } finally {
            setTimeout(() => {
                setExportingType(null)
            }, 3000)
        }
    }

    const isLoading = exportingType !== null

    return (
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
            <div className="flex flex-col gap-1.5">
                <select
                    value={quincena}
                    onChange={(e) => setQuincena(e.target.value)}
                    className="h-10 px-3 py-2 bg-white border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                    title="Quincena para Planos Contables"
                >
                    <option value="1Q">1Q (1-14)</option>
                    <option value="2Q">2Q (15-fin)</option>
                </select>
            </div>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="default"
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 h-10"
                        disabled={isLoading}
                    >
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        {isLoading ? 'Generando...' : 'Exportar Excel'}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Reportes Generales</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => handleExport('consolidado')} disabled={isLoading} className="cursor-pointer">
                        <FileSpreadsheet className="mr-2 h-4 w-4 text-emerald-600" />
                        <span>Consolidado de Horas</span>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <DropdownMenuLabel>Planos</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => handleExport('extras', true)} disabled={isLoading} className="cursor-pointer">
                        <FileDown className="mr-2 h-4 w-4" />
                        <span>Plano de Extras / Recargos</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport('auxilios', true)} disabled={isLoading} className="cursor-pointer">
                        <FileDown className="mr-2 h-4 w-4" />
                        <span>Plano Auxilios Ocasionales</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport('incapacidades', true)} disabled={isLoading} className="cursor-pointer">
                        <FileDown className="mr-2 h-4 w-4" />
                        <span>Plano de Incapacidades</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport('ausentismos', true)} disabled={isLoading} className="cursor-pointer">
                        <FileDown className="mr-2 h-4 w-4" />
                        <span>Plano de Ausentismos</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}

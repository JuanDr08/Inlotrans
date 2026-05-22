'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { FileSpreadsheet, Download } from 'lucide-react'
import { TIPOS_AUSENTISMO, CLASES_AUSENTISMO, CAUSAS_AUSENTISMO } from '@/lib/constants/ausentismos'

type TipoPlano = 'cumpleanos' | 'auxilio' | 'extras' | 'otro'

const PLANOS: { value: TipoPlano; label: string }[] = [
    { value: 'cumpleanos', label: 'Cumpleaños' },
    { value: 'auxilio', label: 'Auxilio No Prestacional' },
    { value: 'extras', label: 'Horas Extras' },
    { value: 'otro', label: 'Otro (por ausentismo)' },
]

const MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const PLANO_ROUTES: Record<TipoPlano, string> = {
    cumpleanos: '/api/reportes/planos/cumpleanos',
    auxilio: '/api/reportes/planos/auxilio',
    extras: '/api/reportes/planos/extras',
    otro: '/api/reportes/planos/otro',
}

export function ExportPlanosDialog() {
    const now = new Date()
    const [plano, setPlano] = useState<TipoPlano>('cumpleanos')
    const [mes, setMes] = useState(String(now.getMonth()))
    const [anio, setAnio] = useState(String(now.getFullYear()))
    const [quincena, setQuincena] = useState<'1' | '2'>('1')
    const [tipoAusentismo, setTipoAusentismo] = useState('')
    const [causaAusentismo, setCausaAusentismo] = useState('')
    const [claseAusentismo, setClaseAusentismo] = useState('')
    const [open, setOpen] = useState(false)

    const isOtro = plano === 'otro'
    const canDownload = isOtro ? !!(tipoAusentismo && causaAusentismo && claseAusentismo) : true

    function handleDownload() {
        const route = PLANO_ROUTES[plano]
        if (!route) return

        const mesNum = parseInt(mes) + 1
        const params = new URLSearchParams({
            anio,
            mes: String(mesNum),
            quincena,
        })

        if (isOtro) {
            params.set('tipo', tipoAusentismo)
            params.set('causa', causaAusentismo)
            params.set('clase', claseAusentismo)
        }

        window.open(`${route}?${params.toString()}`, '_blank')
        setOpen(false)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    className="h-10 gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50"
                >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Planos</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Exportar plano de ausentismo</DialogTitle>
                    <DialogDescription>
                        Selecciona el tipo de plano y el periodo a descargar.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-2">
                    <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                            Tipo de plano
                        </Label>
                        <Select value={plano} onValueChange={(v) => setPlano(v as TipoPlano)}>
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {PLANOS.map((p) => (
                                    <SelectItem key={p.value} value={p.value}>
                                        {p.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {isOtro && (
                        <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                                    Tipo
                                </Label>
                                <Select value={tipoAusentismo} onValueChange={setTipoAusentismo}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Tipo..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(TIPOS_AUSENTISMO).map(([code, label]) => (
                                            <SelectItem key={code} value={code}>
                                                {code} - {label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                                    Clase
                                </Label>
                                <Select value={claseAusentismo} onValueChange={setClaseAusentismo}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Clase..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(CLASES_AUSENTISMO).map(([code, label]) => (
                                            <SelectItem key={code} value={code}>
                                                {code} - {label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                                    Causa
                                </Label>
                                <Select value={causaAusentismo} onValueChange={setCausaAusentismo}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Causa..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(CAUSAS_AUSENTISMO).map(([code, label]) => (
                                            <SelectItem key={code} value={code}>
                                                {code} - {label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                                Mes
                            </Label>
                            <Select value={mes} onValueChange={setMes}>
                                <SelectTrigger className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {MESES.map((m, i) => (
                                        <SelectItem key={i} value={String(i)}>
                                            {m}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                                Año
                            </Label>
                            <Select value={anio} onValueChange={setAnio}>
                                <SelectTrigger className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
                                        <SelectItem key={y} value={String(y)}>
                                            {y}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                                Quincena
                            </Label>
                            <Select value={quincena} onValueChange={(v) => setQuincena(v as '1' | '2')}>
                                <SelectTrigger className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">1Q (1-15)</SelectItem>
                                    <SelectItem value="2">2Q (16-fin)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        onClick={handleDownload}
                        disabled={!canDownload}
                        className="gap-1.5 bg-amber-600 hover:bg-amber-700"
                    >
                        <Download className="h-3.5 w-3.5" />
                        Descargar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

import XLSX from 'xlsx-js-style'
import {
    TIPOS_AUSENTISMO,
    CLASES_AUSENTISMO,
    CAUSAS_AUSENTISMO,
} from '@/lib/constants/ausentismos'

export interface NovedadGenericaPlano {
    cedula: string
    fecha_novedad: string   // ISO YYYY-MM-DD
    fecha_inicio: string | null
    fecha_fin: string | null
    es_pagado: boolean
}

function calcularDias(n: NovedadGenericaPlano): number {
    if (n.fecha_inicio && n.fecha_fin) {
        const ini = new Date(n.fecha_inicio)
        const fin = new Date(n.fecha_fin)
        return Math.max(1, Math.round((fin.getTime() - ini.getTime()) / 86400000) + 1)
    }
    return 1
}

function fechaInicio(n: NovedadGenericaPlano): string {
    return n.fecha_inicio ?? n.fecha_novedad
}

function formatMMDDYY(iso: string): string {
    const [y, m, d] = iso.split('-')
    return `${m}/${d}/${y.slice(2)}`
}

function formatDDMMYYYY(iso: string): string {
    const [y, m, d] = iso.split('-')
    return `${d}${m}${y}`
}

function addDaysISO(iso: string, days: number): string {
    const d = new Date(iso)
    d.setDate(d.getDate() + days)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${dd}`
}

export function generarPlanoOtro(
    novedades: NovedadGenericaPlano[],
    tipo: number,
    clase: number,
    causa: number,
): Uint8Array {
    const wb = XLSX.utils.book_new()

    // ── Hoja 1 ──────────────────────────────────────────────────
    const ws1: XLSX.WorkSheet = {}
    let currentRow = 0

    const headerBlock: [string, string | number, string?][] = [
        ['TIPO AUSENTISMO', tipo, TIPOS_AUSENTISMO[tipo] ?? ''],
        ['CLASE AUSENTISMO', clase, CLASES_AUSENTISMO[clase] ?? ''],
        ['CAUSA AUSENTISMO', causa, CAUSAS_AUSENTISMO[causa] ?? ''],
        ['PORCENTAJE', 0],
        ['FORMA DE LIQUIDACION', 'BASICO'],
        ['BASE', 0],
    ]

    for (const row of headerBlock) {
        XLSX.utils.sheet_add_aoa(ws1, [row], { origin: currentRow })
        currentRow++
    }

    currentRow++ // fila vacía

    XLSX.utils.sheet_add_aoa(ws1, [[
        'CODIGO EMPLEADO DESIGNER',
        'DIAS AUSENTISMO',
        'FECHA INICIAL AUSENTISMO',
        'FECHA INICIAL PAGO AUSENTISMO',
    ]], { origin: currentRow })
    currentRow++

    for (const n of novedades) {
        const dias = calcularDias(n)
        const inicio = fechaInicio(n)
        XLSX.utils.sheet_add_aoa(ws1, [[
            Number(n.cedula) || n.cedula,
            dias,
            formatMMDDYY(inicio),
            formatMMDDYY(inicio),
            CAUSAS_AUSENTISMO[causa] ?? '',
        ]], { origin: currentRow })
        currentRow++
    }

    XLSX.utils.book_append_sheet(wb, ws1, 'Hoja 1')

    // ── Hoja 2 ──────────────────────────────────────────────────
    const ws2: XLSX.WorkSheet = {}
    let currentRow2 = 0

    for (const n of novedades) {
        const dias = calcularDias(n)
        const inicio = fechaInicio(n)
        const fin = dias > 1 ? addDaysISO(inicio, dias - 1) : inicio
        const claseNovedad = n.es_pagado ? 1 : 2

        XLSX.utils.sheet_add_aoa(ws2, [[
            Number(n.cedula) || n.cedula,
            tipo,
            claseNovedad,
            causa,
            dias,
            formatDDMMYYYY(inicio),
            formatDDMMYYYY(fin),
            formatDDMMYYYY(inicio),
            formatDDMMYYYY(inicio),
            formatDDMMYYYY(fin),
            0,
            '',
            'BASICO',
        ]], { origin: currentRow2 })
        currentRow2++
    }

    XLSX.utils.book_append_sheet(wb, ws2, 'Hoja 2')

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Uint8Array
}

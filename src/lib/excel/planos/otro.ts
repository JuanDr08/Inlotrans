import ExcelJS from 'exceljs'
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

export async function generarPlanoOtro(
    novedades: NovedadGenericaPlano[],
    tipo: number,
    clase: number,
    causa: number,
): Promise<Buffer> {
    const wb = new ExcelJS.Workbook()

    // ── Hoja 1 ──────────────────────────────────────────────────
    const ws1 = wb.addWorksheet('Hoja 1')

    const headerBlock: [string, string | number, string?][] = [
        ['TIPO AUSENTISMO', tipo, TIPOS_AUSENTISMO[tipo] ?? ''],
        ['CLASE AUSENTISMO', clase, CLASES_AUSENTISMO[clase] ?? ''],
        ['CAUSA AUSENTISMO', causa, CAUSAS_AUSENTISMO[causa] ?? ''],
        ['PORCENTAJE', 0],
        ['FORMA DE LIQUIDACION', 'BASICO'],
        ['BASE', 0],
    ]

    for (const row of headerBlock) {
        ws1.addRow(row)
    }

    ws1.addRow([])

    ws1.addRow([
        'CODIGO EMPLEADO DESIGNER',
        'DIAS AUSENTISMO',
        'FECHA INICIAL AUSENTISMO',
        'FECHA INICIAL PAGO AUSENTISMO',
    ])

    for (const n of novedades) {
        const dias = calcularDias(n)
        const inicio = fechaInicio(n)
        ws1.addRow([
            Number(n.cedula) || n.cedula,
            dias,
            formatMMDDYY(inicio),
            formatMMDDYY(inicio),
            CAUSAS_AUSENTISMO[causa] ?? '',
        ])
    }

    // ── Hoja 2 ──────────────────────────────────────────────────
    const ws2 = wb.addWorksheet('Hoja 2')

    for (const n of novedades) {
        const dias = calcularDias(n)
        const inicio = fechaInicio(n)
        const fin = dias > 1 ? addDaysISO(inicio, dias - 1) : inicio
        const clase = n.es_pagado ? 1 : 2

        ws2.addRow([
            Number(n.cedula) || n.cedula,
            tipo,
            clase,
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
        ])
    }

    const buffer = await wb.xlsx.writeBuffer()
    return Buffer.from(buffer)
}

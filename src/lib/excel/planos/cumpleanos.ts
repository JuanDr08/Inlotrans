import ExcelJS from 'exceljs'
import {
    TIPOS_AUSENTISMO,
    CLASES_AUSENTISMO,
    CAUSAS_AUSENTISMO,
} from '@/lib/constants/ausentismos'

export interface NovedadCumpleanos {
    cedula: string
    fecha_novedad: string // ISO YYYY-MM-DD
}

const TIPO = 6
const CLASE = 1
const CAUSA = 1

function formatMMDDYY(iso: string): string {
    const [y, m, d] = iso.split('-')
    return `${m}/${d}/${y.slice(2)}`
}

function formatDDMMYYYY(iso: string): string {
    const [y, m, d] = iso.split('-')
    return `${d}${m}${y}`
}

export async function generarPlanoCumpleanos(
    novedades: NovedadCumpleanos[],
): Promise<Buffer> {
    const wb = new ExcelJS.Workbook()

    // ── Hoja 1 ──────────────────────────────────────────────────
    const ws1 = wb.addWorksheet('Hoja 1')

    const headerBlock: [string, string | number, string?][] = [
        ['TIPO AUSENTISMO', TIPO, TIPOS_AUSENTISMO[TIPO]],
        ['CLASE AUSENTISMO', CLASE, CLASES_AUSENTISMO[CLASE]],
        ['CAUSA AUSENTISMO', CAUSA, CAUSAS_AUSENTISMO[CAUSA]],
        ['PORCENTAJE', 0],
        ['FORMA DE LIQUIDACION', 'BASICO'],
        ['BASE', 0],
    ]

    for (const row of headerBlock) {
        ws1.addRow(row)
    }

    ws1.addRow([]) // fila vacía

    ws1.addRow([
        'CODIGO EMPLEADO DESIGNER',
        'DIAS AUSENTISMO',
        'FECHA INICIAL AUSENTISMO',
        'FECHA INICIAL PAGO AUSENTISMO',
    ])

    for (const n of novedades) {
        const fecha = formatMMDDYY(n.fecha_novedad)
        ws1.addRow([
            Number(n.cedula) || n.cedula,
            1,
            fecha,
            fecha,
            'DIA DE CUMPLEAÑOS',
        ])
    }

    // ── Hoja 2 ──────────────────────────────────────────────────
    const ws2 = wb.addWorksheet('Hoja 2')

    for (const n of novedades) {
        const fecha = formatDDMMYYYY(n.fecha_novedad)
        ws2.addRow([
            Number(n.cedula) || n.cedula,
            TIPO,
            CLASE,
            CAUSA,
            1,
            fecha,
            fecha,
            fecha,
            fecha,
            fecha,
            0,
            '',
            'BASICO',
        ])
    }

    const buffer = await wb.xlsx.writeBuffer()
    return Buffer.from(buffer)
}

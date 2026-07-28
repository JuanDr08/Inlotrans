import XLSX from 'xlsx-js-style'
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

export function generarPlanoCumpleanos(
    novedades: NovedadCumpleanos[],
): Uint8Array {
    const wb = XLSX.utils.book_new()

    // ── Hoja 1 ──────────────────────────────────────────────────
    const ws1: XLSX.WorkSheet = {}
    let currentRow = 0

    const headerBlock: [string, string | number, string?][] = [
        ['TIPO AUSENTISMO', TIPO, TIPOS_AUSENTISMO[TIPO]],
        ['CLASE AUSENTISMO', CLASE, CLASES_AUSENTISMO[CLASE]],
        ['CAUSA AUSENTISMO', CAUSA, CAUSAS_AUSENTISMO[CAUSA]],
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
        const fecha = formatMMDDYY(n.fecha_novedad)
        XLSX.utils.sheet_add_aoa(ws1, [[
            Number(n.cedula) || n.cedula,
            1,
            fecha,
            fecha,
            'DIA DE CUMPLEAÑOS',
        ]], { origin: currentRow })
        currentRow++
    }

    XLSX.utils.book_append_sheet(wb, ws1, 'Hoja 1')

    // ── Hoja 2 ──────────────────────────────────────────────────
    const ws2: XLSX.WorkSheet = {}
    let currentRow2 = 0

    for (const n of novedades) {
        const fecha = formatDDMMYYYY(n.fecha_novedad)
        XLSX.utils.sheet_add_aoa(ws2, [[
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
        ]], { origin: currentRow2 })
        currentRow2++
    }

    XLSX.utils.book_append_sheet(wb, ws2, 'Hoja 2')

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Uint8Array
}

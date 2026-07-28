import XLSX from 'xlsx-js-style'
import { CODIGOS_NOMINA, MESES_ABREVIADOS } from '@/lib/constants/ausentismos'

export interface NovedadAuxilio {
    cedula: string
    valor: number
}

export interface PeriodoPlano {
    anio: number
    mes: number       // 1-indexed
    quincena: 1 | 2
}

function formatFechaDD_MM_YYYY(anio: number, mes: number, dia: number): string {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(dia)}-${pad(mes)}-${anio}`
}

function buildDocSoporte(periodo: PeriodoPlano): string {
    return `AU NO PRE ${periodo.quincena}${MESES_ABREVIADOS[periodo.mes - 1]}`
}

function buildPeriodicidad(quincena: 1 | 2): string {
    return `${quincena}-QUINCENAL`
}

function setCell(ws: XLSX.WorkSheet, r: number, c: number, v: string | number): void {
    const addr = XLSX.utils.encode_cell({ r, c })
    ws[addr] = { v, t: typeof v === 'number' ? 'n' : 's' }
}

export function generarPlanoAuxilio(
    novedades: NovedadAuxilio[],
    periodo: PeriodoPlano,
): Uint8Array {
    const wb = XLSX.utils.book_new()
    const { anio, mes, quincena } = periodo

    const lastDay = new Date(anio, mes, 0).getDate()
    const startDay = quincena === 1 ? 1 : 16
    const endDay = quincena === 1 ? 15 : lastDay

    const fechaInicio = formatFechaDD_MM_YYYY(anio, mes, startDay)
    const fechaFin = formatFechaDD_MM_YYYY(anio, mes, endDay)
    const docSoporte = buildDocSoporte(periodo)
    const periodicidad = buildPeriodicidad(quincena)

    // ── Hoja 1 ──────────────────────────────────────────────────
    const ws1: XLSX.WorkSheet = {}
    let currentRow = 0

    const headerBlock: [string, string][] = [
        ['FECHA INICIAL PERIODO', fechaInicio],
        ['FECHA FINAL PERIODO', fechaFin],
        ['DOCUMENTO SOPORTE', docSoporte],
        ['PERIODICIDAD', periodicidad],
        ['TIPO NOVEDAD', 'OCASIONAL'],
    ]

    for (const row of headerBlock) {
        XLSX.utils.sheet_add_aoa(ws1, [row], { origin: currentRow })
        currentRow++
    }

    currentRow++ // fila vacía

    const codigosEntries = Object.entries(CODIGOS_NOMINA).map(([code, label]) => [
        parseInt(code),
        label,
    ])

    for (let i = 0; i < codigosEntries.length; i++) {
        setCell(ws1, i, 4, codigosEntries[i][0] as number)
        setCell(ws1, i, 5, codigosEntries[i][1] as string)
    }

    currentRow++ // fila vacía

    XLSX.utils.sheet_add_aoa(ws1, [[
        'CEDULA', '', 'CONCEPTO', '', 'VALOR', 'SALDO', 'NIT', 'HORAS', 'MINUTOS',
    ]], { origin: currentRow })
    currentRow++

    for (const n of novedades) {
        XLSX.utils.sheet_add_aoa(ws1, [[
            Number(n.cedula) || n.cedula,
            '',
            12530,
            '',
            n.valor,
            '',
            '',
            '',
            '',
            'AUX NO PRESTACIONAL',
        ]], { origin: currentRow })
        currentRow++
    }

    // El bloque de códigos (columnas E/F) puede exceder el rango escrito por sheet_add_aoa
    const ws1Range = XLSX.utils.decode_range(ws1['!ref'] ?? 'A1:A1')
    ws1Range.e.r = Math.max(ws1Range.e.r, codigosEntries.length - 1)
    ws1Range.e.c = Math.max(ws1Range.e.c, 5)
    ws1['!ref'] = XLSX.utils.encode_range(ws1Range)

    XLSX.utils.book_append_sheet(wb, ws1, 'Hoja 1')

    // ── Hoja 2 ──────────────────────────────────────────────────
    const ws2: XLSX.WorkSheet = {}
    let currentRow2 = 0

    for (const n of novedades) {
        XLSX.utils.sheet_add_aoa(ws2, [[
            12530,
            Number(n.cedula) || n.cedula,
            fechaInicio,
            fechaFin,
            fechaInicio,
            docSoporte,
            n.valor,
            quincena === 1 ? 6 : quincena === 2 ? 4 : 2,
            0,
            '',
            '',
            '',
            'OCASIONAL',
        ]], { origin: currentRow2 })
        currentRow2++
    }

    XLSX.utils.book_append_sheet(wb, ws2, 'Hoja 2')

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Uint8Array
}

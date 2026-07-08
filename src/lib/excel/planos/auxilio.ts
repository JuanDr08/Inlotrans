import ExcelJS from 'exceljs'
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

export async function generarPlanoAuxilio(
    novedades: NovedadAuxilio[],
    periodo: PeriodoPlano,
): Promise<ArrayBuffer> {
    const wb = new ExcelJS.Workbook()
    const { anio, mes, quincena } = periodo

    const lastDay = new Date(anio, mes, 0).getDate()
    const startDay = quincena === 1 ? 1 : 16
    const endDay = quincena === 1 ? 15 : lastDay

    const fechaInicio = formatFechaDD_MM_YYYY(anio, mes, startDay)
    const fechaFin = formatFechaDD_MM_YYYY(anio, mes, endDay)
    const docSoporte = buildDocSoporte(periodo)
    const periodicidad = buildPeriodicidad(quincena)

    // ── Hoja 1 ──────────────────────────────────────────────────
    const ws1 = wb.addWorksheet('Hoja 1')

    const headerBlock: [string, string][] = [
        ['FECHA INICIAL PERIODO', fechaInicio],
        ['FECHA FINAL PERIODO', fechaFin],
        ['DOCUMENTO SOPORTE', docSoporte],
        ['PERIODICIDAD', periodicidad],
        ['TIPO NOVEDAD', 'OCASIONAL'],
    ]

    for (const row of headerBlock) {
        ws1.addRow(row)
    }

    ws1.addRow([]) // fila vacía

    const codigosEntries = Object.entries(CODIGOS_NOMINA).map(([code, label]) => [
        parseInt(code),
        label,
    ])

    for (let i = 0; i < codigosEntries.length; i++) {
        const targetRow = ws1.getRow(i + 1)
        targetRow.getCell(5).value = codigosEntries[i][0]
        targetRow.getCell(6).value = codigosEntries[i][1]
    }

    ws1.addRow([]) // fila vacía

    ws1.addRow([
        'CEDULA', '', 'CONCEPTO', '', 'VALOR', 'SALDO', 'NIT', 'HORAS', 'MINUTOS',
    ])

    for (const n of novedades) {
        ws1.addRow([
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
        ])
    }

    // ── Hoja 2 ──────────────────────────────────────────────────
    const ws2 = wb.addWorksheet('Hoja 2')

    for (const n of novedades) {
        ws2.addRow([
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
        ])
    }

    return await wb.xlsx.writeBuffer() as ArrayBuffer
}

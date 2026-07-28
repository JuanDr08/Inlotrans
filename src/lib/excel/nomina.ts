import XLSX from 'xlsx-js-style'

// ════════════════════════════════════════════════════════════════════
// Tipos
// ════════════════════════════════════════════════════════════════════

export interface LineaNomina {
    fecha: string
    cargo: string
    cedula: string
    nombre: string
    horaIn: number
    horaOut: number
    almuerzo: number
    horas: number
    extraDiurna: number
    extraNocturna: number
    extraFestivaDiurna: number
    extraFestivaNocturna: number
    recargoNocturno: number
    recargoFestivoNocturno: number
    recargoFestivo: number
    operacion: string
    codigoOperacion: string
    detalleOperacion: string
    novedad: string
    detalleNovedad: string
}

export interface TarifaConCodigo {
    tipo_hora: string
    precio_por_hora: number
    codigo_nomina: string | null
}

const COLS_ESPECIALES = [
    { key: 'extraDiurna' as const,           label: 'H.E',    concepto: 'H.E' },
    { key: 'extraNocturna' as const,         label: 'H.E.N',  concepto: 'H.E.N' },
    { key: 'extraFestivaDiurna' as const,    label: 'E.F.D',  concepto: 'E.F.D' },
    { key: 'extraFestivaNocturna' as const,  label: 'E.F.N',  concepto: 'E.F.N' },
    { key: 'recargoNocturno' as const,       label: 'R.N',    concepto: 'R.N' },
    { key: 'recargoFestivoNocturno' as const,label: 'R.F.N',  concepto: 'R.F.N' },
    { key: 'recargoFestivo' as const,        label: 'R.F',    concepto: 'R.F' },
]

const TIPO_HORA_A_COL: Record<string, (typeof COLS_ESPECIALES)[number]['key']> = {
    extra: 'extraDiurna',
    extraNocturno: 'extraNocturna',
    extraDominicalFestivo: 'extraFestivaDiurna',
    extraNocturnaDominicalFestivo: 'extraFestivaNocturna',
    nocturno: 'recargoNocturno',
    domingoFestivoNocturno: 'recargoFestivoNocturno',
    festivo: 'recargoFestivo',
    domingo: 'recargoFestivo',
}

const HORAS_LEGALES_MES = 220

// ════════════════════════════════════════════════════════════════════
// Estilos (xlsx-js-style format)
// ════════════════════════════════════════════════════════════════════

const FONT_DEFAULT = { name: 'Calibri', sz: 10 }
const FONT_HEADER = { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'FFFFFF' } }
const FONT_BOLD = { name: 'Calibri', sz: 10, bold: true }

const FILL_RED = { patternType: 'solid' as const, fgColor: { rgb: 'FF0000' } }
const FILL_GREEN = { patternType: 'solid' as const, fgColor: { rgb: '008000' } }
const FILL_YELLOW = { patternType: 'solid' as const, fgColor: { rgb: 'FFFF00' } }
const FILL_LIGHT_YELLOW = { patternType: 'solid' as const, fgColor: { rgb: 'FFFFCC' } }

const BORDER_THIN = {
    top: { style: 'thin' as const },
    left: { style: 'thin' as const },
    bottom: { style: 'thin' as const },
    right: { style: 'thin' as const },
}

const ALIGN_CENTER = { horizontal: 'center' as const, vertical: 'center' as const }

// ════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════

function cell(r: number, c: number): string {
    return XLSX.utils.encode_cell({ r, c })
}

function setCell(
    ws: XLSX.WorkSheet,
    r: number,
    c: number,
    value: string | number | null | undefined,
    style?: Record<string, unknown>,
): void {
    const addr = cell(r, c)
    const t = typeof value === 'number' ? 'n' : 's'
    ws[addr] = { v: value ?? '', t, s: style ?? {} }
}

function setStyledCell(
    ws: XLSX.WorkSheet,
    r: number,
    c: number,
    value: string | number | null | undefined,
    opts: {
        font?: Record<string, unknown>
        fill?: Record<string, unknown>
        alignment?: Record<string, unknown>
        border?: Record<string, unknown>
        numFmt?: string
    },
): void {
    const addr = cell(r, c)
    const t = typeof value === 'number' ? 'n' : 's'
    const s: Record<string, unknown> = {}
    if (opts.font) s.font = opts.font
    if (opts.fill) s.fill = opts.fill
    if (opts.alignment) s.alignment = opts.alignment
    if (opts.border) s.border = opts.border
    if (opts.numFmt) s.numFmt = opts.numFmt
    ws[addr] = { v: value ?? '', t, s, ...(opts.numFmt ? { z: opts.numFmt } : {}) }
}

// ════════════════════════════════════════════════════════════════════
// Generador
// ════════════════════════════════════════════════════════════════════

export function generarExcelNomina(
    lineas: LineaNomina[],
    tarifas: TarifaConCodigo[],
): Uint8Array {
    const wb = XLSX.utils.book_new()
    wb.Props = { Author: 'Inlotrans Asistencia', CreatedDate: new Date() }
    const ws: XLSX.WorkSheet = {}

    // ─── Columnas ───────────────────────────────────────────────
    ws['!cols'] = [
        { wch: 28 },  // A: fecha
        { wch: 18 },  // B: cargo
        { wch: 16 },  // C: cedula
        { wch: 35 },  // D: nombre
        { wch: 6 },   // E: horaIn
        { wch: 6 },   // F: horaOut
        { wch: 6 },   // G: almuerzo
        { wch: 8 },   // H: horas
        { wch: 10 },  // I: extraDiurna
        { wch: 10 },  // J: extraNocturna
        { wch: 10 },  // K: extraFestivaDiurna
        { wch: 10 },  // L: extraFestivaNocturna
        { wch: 10 },  // M: recargoNocturno
        { wch: 10 },  // N: recargoFestivoNocturno
        { wch: 10 },  // O: recargoFestivo
        { wch: 22 },  // P: operacion
        { wch: 14 },  // Q: codigoOperacion
        { wch: 20 },  // R: detalleOperacion
        { wch: 22 },  // S: novedad
        { wch: 30 },  // T: detalleNovedad
    ]

    ws['!merges'] = []

    // ─── Fila 1 (row 0): Grupo headers ─────────────────────────
    // "HORARIO MILITAR" over E-F (cols 4-5)
    ws['!merges'].push({ s: { r: 0, c: 4 }, e: { r: 0, c: 5 } })
    setStyledCell(ws, 0, 4, 'HORARIO MILITAR', { fill: FILL_GREEN, font: FONT_HEADER, alignment: ALIGN_CENTER })
    setStyledCell(ws, 0, 5, '', { fill: FILL_GREEN, font: FONT_HEADER, alignment: ALIGN_CENTER })

    // "NO MODIFICAR EL FORMATO" over G-H (cols 6-7)
    ws['!merges'].push({ s: { r: 0, c: 6 }, e: { r: 0, c: 7 } })
    setStyledCell(ws, 0, 6, 'NO MODIFICAR EL FORMATO', { fill: FILL_RED, font: FONT_HEADER, alignment: ALIGN_CENTER })
    setStyledCell(ws, 0, 7, '', { fill: FILL_RED, font: FONT_HEADER, alignment: ALIGN_CENTER })

    // Tipos de hora I-O (cols 8-14)
    const tipoHeaders = ['H.E.D', 'H.E.N', 'E.F.D', 'E.F.N', 'R.N', 'R.F.N', 'R.F']
    tipoHeaders.forEach((h, i) => {
        setStyledCell(ws, 0, 8 + i, h, { fill: FILL_RED, font: FONT_HEADER, alignment: ALIGN_CENTER })
    })

    // "COLOCAR DONDE SE COBRARÁ A LA PERSONA" over P-Q (cols 15-16)
    ws['!merges'].push({ s: { r: 0, c: 15 }, e: { r: 0, c: 16 } })
    setStyledCell(ws, 0, 15, 'COLOCAR DONDE SE COBRARÁ A LA PERSONA', { fill: FILL_GREEN, font: FONT_HEADER, alignment: ALIGN_CENTER })
    setStyledCell(ws, 0, 16, '', { fill: FILL_GREEN, font: FONT_HEADER, alignment: ALIGN_CENTER })

    // ─── Fila 2 (row 1): Headers principales ────────────────────
    setStyledCell(ws, 1, 2, 'CEDULAS SIN PUNTO Y CORRECTAS', { font: FONT_BOLD, alignment: { ...ALIGN_CENTER, wrapText: true } })
    setStyledCell(ws, 1, 3, 'DEBE ESTAR POR APELLIDO Y NOMBRE (COMPLETOS)', { font: FONT_BOLD, alignment: { ...ALIGN_CENTER, wrapText: true } })

    // ─── Fila 3 (row 2): Sub-headers de columna ─────────────────
    const subHeaders = [
        'FECHA', 'CARGO', 'CEDULA', 'NOMBRE',
        'IN', 'OUT', 'ALMU', 'HORAS',
        ...tipoHeaders,
        'OPERACIÓN', 'CENTRO DE COSTO', 'DETALLE DE LA OPERACIÓN',
        'NOVEDAD', 'DETALLE DE LA NOVEDAD',
    ]
    subHeaders.forEach((h, i) => {
        const fill = i < 15 ? FILL_RED : FILL_YELLOW
        const font = i < 15 ? FONT_HEADER : FONT_BOLD
        setStyledCell(ws, 2, i, h, { font, fill, alignment: ALIGN_CENTER, border: BORDER_THIN })
    })

    // ─── Fila 4 (row 3): Códigos de nómina debajo de cada tipo ──
    const tarifaMap = new Map(tarifas.map((t) => [t.tipo_hora, t]))
    const codigosOrden = ['extra', 'extraNocturno', 'extraDominicalFestivo', 'extraNocturnaDominicalFestivo', 'nocturno', 'domingoFestivoNocturno', 'festivo']
    codigosOrden.forEach((tipo, i) => {
        const tarifa = tarifaMap.get(tipo)
        const val = tarifa?.codigo_nomina ? Number(tarifa.codigo_nomina) : ''
        setStyledCell(ws, 3, 8 + i, val, { font: FONT_BOLD, alignment: ALIGN_CENTER, border: BORDER_THIN })
    })

    // ─── Datos ──────────────────────────────────────────────────
    let currentRow = 4
    const totales = {
        horaIn: 0, horaOut: 0, almuerzo: 0, horas: 0,
        extraDiurna: 0, extraNocturna: 0, extraFestivaDiurna: 0,
        extraFestivaNocturna: 0, recargoNocturno: 0,
        recargoFestivoNocturno: 0, recargoFestivo: 0,
    }

    for (const linea of lineas) {
        const values: (string | number)[] = [
            linea.fecha, linea.cargo, linea.cedula, linea.nombre,
            linea.horaIn, linea.horaOut, linea.almuerzo, linea.horas,
            linea.extraDiurna, linea.extraNocturna, linea.extraFestivaDiurna,
            linea.extraFestivaNocturna, linea.recargoNocturno,
            linea.recargoFestivoNocturno, linea.recargoFestivo,
            linea.operacion, linea.codigoOperacion, linea.detalleOperacion,
            linea.novedad, linea.detalleNovedad,
        ]

        values.forEach((v, i) => {
            const style: Record<string, unknown> = { font: FONT_DEFAULT }
            if (i >= 4 && i <= 14) style.alignment = ALIGN_CENTER
            else style.alignment = { vertical: 'center' as const }
            setCell(ws, currentRow, i, v, style)
        })

        currentRow++

        totales.horaIn += linea.horaIn
        totales.horaOut += linea.horaOut
        totales.almuerzo += linea.almuerzo
        totales.horas += linea.horas
        totales.extraDiurna += linea.extraDiurna
        totales.extraNocturna += linea.extraNocturna
        totales.extraFestivaDiurna += linea.extraFestivaDiurna
        totales.extraFestivaNocturna += linea.extraFestivaNocturna
        totales.recargoNocturno += linea.recargoNocturno
        totales.recargoFestivoNocturno += linea.recargoFestivoNocturno
        totales.recargoFestivo += linea.recargoFestivo
    }

    // ─── Tabla de totales ───────────────────────────────────────
    currentRow += 2 // 2 filas vacías

    // Fila SUBTOTALES
    const subtotalesVals = [
        totales.horaIn, totales.horaOut, totales.almuerzo, totales.horas,
        totales.extraDiurna, totales.extraNocturna, totales.extraFestivaDiurna,
        totales.extraFestivaNocturna, totales.recargoNocturno,
        totales.recargoFestivoNocturno, totales.recargoFestivo,
    ]
    subtotalesVals.forEach((v, i) => {
        setStyledCell(ws, currentRow, 4 + i, v, { font: FONT_BOLD, alignment: ALIGN_CENTER, border: BORDER_THIN })
    })
    currentRow++

    // Fila CONCEPTO
    const conceptos = ['H.E', 'H.E.N', 'E.F.D', 'E.F.N', 'R.N', 'R.F.N', 'R.F']
    conceptos.forEach((c, i) => {
        setStyledCell(ws, currentRow, 8 + i, c, { font: FONT_BOLD, alignment: ALIGN_CENTER, fill: FILL_LIGHT_YELLOW, border: BORDER_THIN })
    })
    currentRow++

    // Fila CÓDIGO NOMINA
    setStyledCell(ws, currentRow, 3, 'CÓDIGO NOMINA', { font: FONT_BOLD })
    codigosOrden.forEach((tipo, i) => {
        const tarifa = tarifaMap.get(tipo)
        const val = tarifa?.codigo_nomina ? Number(tarifa.codigo_nomina) : ''
        setStyledCell(ws, currentRow, 8 + i, val, { font: FONT_BOLD, alignment: ALIGN_CENTER, fill: FILL_LIGHT_YELLOW, border: BORDER_THIN })
    })
    currentRow++

    // Fila VALOR por hora
    setStyledCell(ws, currentRow, 3, 'VALOR', { font: FONT_BOLD })
    codigosOrden.forEach((tipo, i) => {
        const tarifa = tarifaMap.get(tipo)
        setStyledCell(ws, currentRow, 8 + i, tarifa?.precio_por_hora ?? 0, {
            font: FONT_BOLD, alignment: ALIGN_CENTER, fill: FILL_YELLOW, border: BORDER_THIN, numFmt: '#,##0',
        })
    })
    currentRow++

    // Fila TOTAL (horas × valor)
    setStyledCell(ws, currentRow, 3, 'TOTAL', { font: FONT_BOLD })
    const totalesEspeciales = [
        totales.extraDiurna, totales.extraNocturna, totales.extraFestivaDiurna,
        totales.extraFestivaNocturna, totales.recargoNocturno,
        totales.recargoFestivoNocturno, totales.recargoFestivo,
    ]
    codigosOrden.forEach((tipo, i) => {
        const tarifa = tarifaMap.get(tipo)
        const valor = (tarifa?.precio_por_hora ?? 0) * totalesEspeciales[i]
        setStyledCell(ws, currentRow, 8 + i, valor, {
            font: FONT_BOLD, alignment: ALIGN_CENTER, border: BORDER_THIN, numFmt: '"$"#,##0',
        })
    })
    currentRow++

    // Fila vacía
    currentRow++

    // Fila PORCENTAJE
    const tarifaNormal = tarifaMap.get('normal')?.precio_por_hora ?? 7959
    setStyledCell(ws, currentRow, 3, 'PORCENTAJE', { font: FONT_BOLD })
    codigosOrden.forEach((tipo, i) => {
        const tarifa = tarifaMap.get(tipo)
        const pct = tarifa ? Math.round(((tarifa.precio_por_hora / tarifaNormal) - 1) * 100) : 0
        setStyledCell(ws, currentRow, 8 + i, `${pct}%`, {
            font: FONT_BOLD, alignment: ALIGN_CENTER, fill: FILL_YELLOW, border: BORDER_THIN,
        })
    })
    currentRow++

    // Fila salario base y valor hora
    const salarioBase = Math.round(tarifaNormal * HORAS_LEGALES_MES)
    setStyledCell(ws, currentRow, 4, salarioBase, { font: FONT_BOLD, numFmt: '#,##0' })
    setStyledCell(ws, currentRow, 5, tarifaNormal, { font: FONT_BOLD, numFmt: '#,##0' })
    codigosOrden.forEach((tipo, i) => {
        const tarifa = tarifaMap.get(tipo)
        setCell(ws, currentRow, 8 + i, tarifa?.precio_por_hora ?? 0, {
            alignment: ALIGN_CENTER,
            numFmt: '#,##0',
        })
    })

    // ─── Frozen panes ───────────────────────────────────────────
    ws['!freeze'] = { xSplit: 0, ySplit: 4, topLeftCell: 'A5', activePane: 'bottomLeft', state: 'frozen' }

    // ─── Auto-filter en headers ─────────────────────────────────
    ws['!autofilter'] = { ref: 'A3:T3' }

    // ─── Set range ──────────────────────────────────────────────
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: currentRow, c: 19 } })

    XLSX.utils.book_append_sheet(wb, ws, 'Nómina')

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Uint8Array
}

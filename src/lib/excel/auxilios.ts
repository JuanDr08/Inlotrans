import ExcelJS from 'exceljs'
import { SupabaseClient } from '@supabase/supabase-js'

const CODIGO_AUXILIO = 12530
const NOMBRES_MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']

function formatearFecha(fecha: Date) {
    const dia = String(fecha.getDate()).padStart(2, '0')
    const mes = String(fecha.getMonth() + 1).padStart(2, '0')
    const anio = fecha.getFullYear()
    return `${dia}-${mes}-${anio}`
}

interface PeriodoFlags {
    quincena: string
    mes: number
    anio: number
}

function calcularPeriodo({ quincena, mes, anio }: PeriodoFlags) {
    const fechaInicio = quincena === '1Q'
        ? new Date(anio, mes, 1, 0, 0, 0)
        : new Date(anio, mes, 15, 0, 0, 0)

    const fechaFin = quincena === '1Q'
        ? new Date(anio, mes, 14, 23, 59, 59)
        : new Date(anio, mes + 1, 0, 23, 59, 59)

    return { fechaInicio, fechaFin }
}

export async function generarExcelAuxilios(supabase: SupabaseClient, opciones: PeriodoFlags): Promise<ArrayBuffer> {
    const { quincena, mes, anio } = opciones
    const { fechaInicio, fechaFin } = calcularPeriodo({ quincena, mes, anio })

    // Build workbook
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'AsistenceV2 - Inlotrans'

    // ============================================
    // Query a Novedades V2 (Supabase)
    // ============================================
    const fechaInicioIso = fechaInicio.toISOString().split('T')[0]
    const fechaFinIso = fechaFin.toISOString().split('T')[0]

    const { data: auxilios } = await supabase
        .from('novedades')
        .select(`
            usuario_id,
            valor_monetario,
            fecha_novedad,
            usuario:usuarios(nombre, status)
        `)
        .eq('tipo_novedad', 'auxilio_no_prestacional')
        .gte('fecha_novedad', fechaInicioIso)
        .lte('fecha_novedad', fechaFinIso)
        .order('usuario_id', { ascending: true })

    // Filtrar en memoria por usuario activo
    const auxiliosActivos = auxilios?.filter(a => (a.usuario as any)?.status === 'activo') || []

    // ============================================
    // HOJA 1
    // ============================================
    const sheet1 = workbook.addWorksheet('Hoja1')

    const nombreMes = NOMBRES_MESES[mes]
    const diaInicio = fechaInicio.getDate()
    const documentoSoporte = `AUX NO PRE ${diaInicio}${nombreMes}`
    const periodicidad = quincena === '1Q' ? '1-Quincenal' : '2-Quincenal'
    const periodicidadHoja2 = quincena === '1Q' ? 6 : 4

    sheet1.getCell('A1').value = 'FECHA INICIAL PERIODO'
    sheet1.getCell('B1').value = formatearFecha(fechaInicio)
    sheet1.getCell('A2').value = 'FECHA FINAL PERIODO'
    sheet1.getCell('B2').value = formatearFecha(fechaFin)
    sheet1.getCell('A3').value = 'DOCUMENTO SOPORTE'
    sheet1.getCell('B3').value = documentoSoporte
    sheet1.getCell('A4').value = 'PERIODICIDAD'
    sheet1.getCell('B4').value = periodicidad
    sheet1.getCell('A5').value = 'TIPO NOVEDAD'
    sheet1.getCell('B5').value = 'OCASIONAL'

    const codigosYDescripciones = [
        [11001, 'EXTRAS DIURNA ORDINARIA 125%'],
        [11002, 'EXTRAS NOCT ORDINARIA 175%'],
        [11003, 'EXTRAS DIURN FEST DOMIN 200%'],
        [11004, 'EXTRAS NOCT FEST DOMIN 250%'],
        [11501, 'RECARGO NOCTURNO 35%'],
        [11502, 'RECARGO FESTIVO DIURNO 75%'],
        [11503, 'RECARGO FEST NOCTURNO 110%'],
        [11504, 'RECARGO ORD FEST NOCT 210%'],
        [12011, 'AUXILIO TRANSPORTE (MANUAL)'],
        [12530, 'AUXILIO NO PRESTACIONAL']
    ]

    codigosYDescripciones.forEach(([codigo, descripcion], i) => {
        const rowNum = i + 1
        sheet1.getCell(`D${rowNum}`).value = codigo
        sheet1.getCell(`E${rowNum}`).value = descripcion
        if (codigo === 12530) sheet1.getCell(`F${rowNum}`).value = 'AUX NO PRE'

            // Color verde claro #92D050
            ;['D', 'E', 'F'].forEach(col => {
                sheet1.getCell(`${col}${rowNum}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF92D050' } }
            })
    })

    const encabezadosHoja1 = ['CÉDULA', 'CONCEPTO', 'VALOR', 'SALDO', 'NIT', 'HORAS', 'MINUTOS']
    const titleRow = sheet1.getRow(12)
    encabezadosHoja1.forEach((enc, i) => {
        const cell = titleRow.getCell(i + 1)
        cell.value = enc
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } }
    })

    let filaActual = 13
    auxiliosActivos.forEach(aux => {
        sheet1.getCell(`A${filaActual}`).value = aux.usuario_id
        sheet1.getCell(`B${filaActual}`).value = CODIGO_AUXILIO
        sheet1.getCell(`C${filaActual}`).value = Math.round(aux.valor_monetario || 0)
        sheet1.getCell(`D${filaActual}`).value = ''
        sheet1.getCell(`E${filaActual}`).value = ''
        sheet1.getCell(`F${filaActual}`).value = ''
        sheet1.getCell(`G${filaActual}`).value = ''
        filaActual++
    })

    sheet1.getColumn('A').width = 25
    sheet1.getColumn('B').width = 20
    sheet1.getColumn('C').width = 5
    sheet1.getColumn('D').width = 12
    sheet1.getColumn('E').width = 38
    sheet1.getColumn('F').width = 15

    // ============================================
    // HOJA 2
    // ============================================
    const sheet2 = workbook.addWorksheet('Hoja2')

    const encabezadosHoja2 = [
        'CONCEPTO', 'CÉDULA', 'FECHA INICIAL', 'FECHA FINAL', 'FECHA REGISTRO',
        'DOCUMENTO SOPORTE', 'VALOR', 'PERIODICIDAD', 'NIT', 'SALDO',
        'HORAS', 'MINUTOS', 'TIPO NOVEDAD'
    ]

    const titleRowH2 = sheet2.getRow(1)
    encabezadosHoja2.forEach((enc, i) => {
        const cell = titleRowH2.getCell(i + 1)
        cell.value = enc
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } }
    })

    let filaActualH2 = 2
    const fInicioStr = formatearFecha(fechaInicio)
    const fFinStr = formatearFecha(fechaFin)

    auxiliosActivos.forEach(aux => {
        sheet2.getCell(`A${filaActualH2}`).value = CODIGO_AUXILIO
        sheet2.getCell(`B${filaActualH2}`).value = aux.usuario_id
        sheet2.getCell(`C${filaActualH2}`).value = fInicioStr
        sheet2.getCell(`D${filaActualH2}`).value = fFinStr
        sheet2.getCell(`E${filaActualH2}`).value = fInicioStr
        sheet2.getCell(`F${filaActualH2}`).value = documentoSoporte
        sheet2.getCell(`G${filaActualH2}`).value = Math.round(aux.valor_monetario || 0)
        sheet2.getCell(`H${filaActualH2}`).value = periodicidadHoja2
        sheet2.getCell(`I${filaActualH2}`).value = ''
        sheet2.getCell(`J${filaActualH2}`).value = ''
        sheet2.getCell(`K${filaActualH2}`).value = ''
        sheet2.getCell(`L${filaActualH2}`).value = ''
        sheet2.getCell(`M${filaActualH2}`).value = 'Ocasional'
        filaActualH2++
    })

    sheet2.getColumn('A').width = 12
    sheet2.getColumn('B').width = 12
    sheet2.getColumn('C').width = 15
    sheet2.getColumn('D').width = 15
    sheet2.getColumn('E').width = 15
    sheet2.getColumn('F').width = 18
    sheet2.getColumn('G').width = 12
    sheet2.getColumn('M').width = 15

    const buffer = await workbook.xlsx.writeBuffer()
    return buffer as ArrayBuffer
}

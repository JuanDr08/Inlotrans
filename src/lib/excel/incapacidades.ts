import ExcelJS from 'exceljs'
import { SupabaseClient } from '@supabase/supabase-js'

const TIPO_AUSENTISMO_INCAPACIDADES = 1
const CLASE_AUSENTISMO_REMUNERADAS = 1
const CLASE_AUSENTISMO_NO_REMUNERADAS = 2

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

function formatearFechaDDMMYYYY(fecha: Date) {
    const dia = String(fecha.getDate()).padStart(2, '0')
    const mes = String(fecha.getMonth() + 1).padStart(2, '0')
    const anio = fecha.getFullYear()
    return `${dia}/${mes}/${anio}`
}

function convertirAFechaExcel(fecha: Date) {
    const epoch = new Date(1899, 11, 30)
    const diffTime = fecha.getTime() - epoch.getTime()
    return Math.floor(diffTime / (1000 * 60 * 60 * 24))
}

export async function generarExcelIncapacidades(supabase: SupabaseClient, opciones: PeriodoFlags): Promise<ArrayBuffer> {
    const { quincena, mes, anio } = opciones
    const { fechaInicio, fechaFin } = calcularPeriodo({ quincena, mes, anio })

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'AsistenceV2 - Inlotrans'

    // ============================================
    // Query a Novedades V2 (Supabase)
    // ============================================
    const fechaInicioIso = fechaInicio.toISOString().split('T')[0]
    const fechaFinIso = fechaFin.toISOString().split('T')[0]

    // Solape logic directly mapped to PostgreSQL syntax using Supabase
    const { data: incapacidades } = await supabase
        .from('novedades')
        .select(`
            usuario_id,
            remunerable,
            start_date,
            end_date,
            causa,
            usuario:usuarios(nombre, status)
        `)
        .eq('tipo_novedad', 'incapacidad')
        // Validar solape: (n.start_date <= end AND n.end_date >= start)
        .lte('start_date', fechaFinIso)
        .gte('end_date', fechaInicioIso)
        .order('usuario_id', { ascending: true })

    const incsActivos = incapacidades?.filter(a => (a.usuario as any)?.status === 'activo') || []

    // ============================================
    // HOJA 1
    // ============================================
    const hoja1 = workbook.addWorksheet('Hoja1')

    hoja1.getCell('A1').value = 'TIPO AUSENTISMO'
    hoja1.getCell('A1').font = { bold: true }
    hoja1.getCell('B1').value = TIPO_AUSENTISMO_INCAPACIDADES
    hoja1.getCell('C1').value = 'INCAPACIDADES'

    hoja1.getCell('A2').value = 'CLASE AUSENTISMO'
    hoja1.getCell('A2').font = { bold: true }
    hoja1.getCell('B2').value = 'Variable'
    hoja1.getCell('C2').value = 'REMUNERADAS o NO REMUNERADAS'

    hoja1.getCell('A3').value = 'CAUSA AUSENTISMO'
    hoja1.getCell('A3').font = { bold: true }
    hoja1.getCell('B3').value = 'Variable'
    hoja1.getCell('C3').value = 'Ver Hoja5 para códigos'

    hoja1.getCell('A4').value = 'PORCENTAJE'
    hoja1.getCell('A4').font = { bold: true }
    hoja1.getCell('B4').value = 0

    hoja1.getCell('A5').value = 'FORMA DE LIQUIDACION'
    hoja1.getCell('A5').font = { bold: true }
    hoja1.getCell('B5').value = 'BASICO'

    hoja1.getCell('A6').value = 'BASE'
    hoja1.getCell('A6').font = { bold: true }
    hoja1.getCell('B6').value = 0

    const encabezadosHoja1 = [
        'CODIGO EMPLEADO DESIGNER',
        'DIAS AUSENTISMO',
        'FECHA INICIAL AUSENTISMO',
        'FECHA INICIAL PAGO AUSENTISMO',
        'CAUSA'
    ]

    const titleRow = hoja1.getRow(8)
    encabezadosHoja1.forEach((enc, i) => {
        const cell = titleRow.getCell(i + 1)
        cell.value = enc
        cell.font = { bold: true }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } } // Gris
        cell.alignment = { horizontal: 'center' }
        cell.border = {
            top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
        }
    })

    let filaActual = 9
    incsActivos.forEach(inc => {
        const fInicio = new Date(inc.start_date)
        const fFin = new Date(inc.end_date || inc.start_date)
        const dias = Math.floor((fFin.getTime() - fInicio.getTime()) / (1000 * 60 * 60 * 24)) + 1

        hoja1.getCell(`A${filaActual}`).value = inc.usuario_id
        hoja1.getCell(`B${filaActual}`).value = dias
        hoja1.getCell(`C${filaActual}`).value = formatearFechaDDMMYYYY(fInicio)
        hoja1.getCell(`D${filaActual}`).value = formatearFechaDDMMYYYY(fInicio)
        hoja1.getCell(`E${filaActual}`).value = inc.causa ? parseInt(inc.causa) : 4 // 4 = ENFERMEDAD GENERAL por defecto
        filaActual++
    })

    hoja1.getColumn('A').width = 30
    hoja1.getColumn('B').width = 20
    hoja1.getColumn('C').width = 30
    hoja1.getColumn('D').width = 30
    hoja1.getColumn('E').width = 25

    // ============================================
    // HOJA 2
    // ============================================
    const hoja2 = workbook.addWorksheet('Hoja2')

    let filaHoja2 = 1
    incsActivos.forEach(inc => {
        const fInicio = new Date(inc.start_date)
        const fFin = new Date(inc.end_date || inc.start_date)
        const dias = Math.floor((fFin.getTime() - fInicio.getTime()) / (1000 * 60 * 60 * 24)) + 1
        const claseAusentismo = inc.remunerable ? CLASE_AUSENTISMO_REMUNERADAS : CLASE_AUSENTISMO_NO_REMUNERADAS

        hoja2.getCell(`A${filaHoja2}`).value = inc.usuario_id
        hoja2.getCell(`B${filaHoja2}`).value = TIPO_AUSENTISMO_INCAPACIDADES
        hoja2.getCell(`C${filaHoja2}`).value = claseAusentismo
        hoja2.getCell(`D${filaHoja2}`).value = inc.causa ? parseInt(inc.causa) : 4
        hoja2.getCell(`E${filaHoja2}`).value = dias
        hoja2.getCell(`F${filaHoja2}`).value = convertirAFechaExcel(fInicio)
        hoja2.getCell(`G${filaHoja2}`).value = convertirAFechaExcel(fFin)
        hoja2.getCell(`H${filaHoja2}`).value = convertirAFechaExcel(fInicio) // fecha novedad
        hoja2.getCell(`I${filaHoja2}`).value = ''
        hoja2.getCell(`J${filaHoja2}`).value = ''
        hoja2.getCell(`K${filaHoja2}`).value = 0
        filaHoja2++
    })

    // ============================================
    // HOJAS 3, 4, 5 (Diccionarios fijos)
    // ============================================
    const diccionarios = {
        'Hoja3': { cols: ['CODIGO', 'TIPO'], data: [[1, 'INCAPACIDADES'], [2, 'PERMISOS'], [3, 'OTROS'], [4, 'COMPENSATORIOS'], [5, 'SUSPENSIÓN CONTRATO TRABAJO'], [6, 'LICENCIA'], [7, 'SANCIÓN']], w: [12, 35] },
        'Hoja4': { cols: ['CODIGO', 'CLASE'], data: [[1, 'REMUNERADAS'], [2, 'NO REMUNERADAS'], [3, 'OTROS']], w: [12, 25] },
        'Hoja5': { cols: ['CODIGO', 'CAUSA'], data: [[1, 'LICENCIA REMUNERADA'], [3, 'MATERNIDAD-PATERNIDAD'], [4, 'ENFERMEDAD GENERAL'], [5, 'ENFERMEDAD PROFESIONAL'], [6, 'ACCIDENTE DE TRABAJO'], [10, 'CITA MEDICA'], [14, 'CALAMIDAD'], [16, 'CUMPLEAÑOS']], w: [12, 55] }
    }

    Object.entries(diccionarios).forEach(([name, def]) => {
        const sheet = workbook.addWorksheet(name)
        sheet.getCell('A1').value = def.cols[0]
        sheet.getCell('B1').value = def.cols[1]
        sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } }
        sheet.getCell('B1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } }
        sheet.getCell('A1').font = { bold: true }
        sheet.getCell('B1').font = { bold: true }

        def.data.forEach((row, i) => {
            sheet.getCell(`A${i + 2}`).value = row[0]
            sheet.getCell(`B${i + 2}`).value = row[1]
        })
        sheet.getColumn('A').width = def.w[0]
        sheet.getColumn('B').width = def.w[1]
    })

    const buffer = await workbook.xlsx.writeBuffer()
    return buffer as ArrayBuffer
}

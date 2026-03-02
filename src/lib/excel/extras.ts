import ExcelJS from 'exceljs'
import { SupabaseClient } from '@supabase/supabase-js'

const CODIGOS_HORAS = {
    horasExtrasOrdinarias: 11001,
    horasExtrasNocturnas: 11002,
    horasExtrasDominicalFestivo: 11230,
    horasExtrasNocturnaDominicalFestivo: 11231,
    horasNocturnas: 11501,
    horasFestivos: 11242,
    horasDomingosFestivosNocturnos: 11243,
    horasDomingos: 11245
}

const DESCRIPCIONES_CODIGOS: Record<number, string> = {
    11001: 'Extras diurna ordinaria',
    11002: 'Extras nocturna ordinaria',
    11230: 'Extras diurna festiva dominical',
    11231: 'Extras nocturna festiva dominical',
    11501: 'Recargo nocturno',
    11242: 'Recargo festivo diurno',
    11243: 'Recargo festivo nocturno',
    11244: 'Recargo ordinario festivo nocturno',
    11245: 'Recargo festivo ordinario',
    12530: 'Auxilio no prestacional'
}

const PORCENTAJES_CODIGOS: Record<number, string> = {
    11001: '125%',
    11002: '175%',
    11230: '200%',
    11231: '250%',
    11501: '35%',
    11242: '75%',
    11243: '110%',
    11244: '210%',
    11245: '175%',
    12530: '—'
}

const TARIFAS_POR_DEFECTO: Record<number, number> = {
    11001: 9948,
    11002: 13928,
    11230: 17111,
    11231: 21091,
    11501: 10745,
    11242: 14326,
    11243: 17111,
    11245: 14326
}

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

export async function generarExcelExtras(supabase: SupabaseClient, opciones: PeriodoFlags): Promise<ArrayBuffer> {
    const { quincena, mes, anio } = opciones
    const { fechaInicio, fechaFin } = calcularPeriodo({ quincena, mes, anio })

    // Build workbook
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'AsistenceV2 - Inlotrans'

    // ============================================
    // HOJA 1
    // ============================================
    const sheet1 = workbook.addWorksheet('Hoja1')

    const nombreMes = NOMBRES_MESES[mes]
    const documentoSoporte = `EXT ${quincena} ${nombreMes}`
    const periodicidad = quincena === '1Q' ? '1-Quincenal' : '2-Quincenal'
    const periodicidadHoja2 = quincena === '1Q' ? 6 : 4

    // Metadatos Izquierda (A1:B5)
    sheet1.getCell('A1').value = 'Fecha inicial período'
    sheet1.getCell('B1').value = formatearFecha(fechaInicio)
    sheet1.getCell('A2').value = 'Fecha final período'
    sheet1.getCell('B2').value = formatearFecha(fechaFin)
    sheet1.getCell('A3').value = 'Documento soporte'
    sheet1.getCell('B3').value = documentoSoporte
    sheet1.getCell('A4').value = 'Periodicidad'
    sheet1.getCell('B4').value = periodicidad
    sheet1.getCell('A5').value = 'Tipo novedad'
    sheet1.getCell('B5').value = 'Ocasional'

    // Codigos Derecha (D1:F10)
    const codigosArray = [11001, 11002, 11230, 11231, 11501, 11242, 11243, 11244, 11245, 12530]

    codigosArray.forEach((codigo, i) => {
        const rowNum = i + 1
        sheet1.getCell(`D${rowNum}`).value = codigo
        sheet1.getCell(`E${rowNum}`).value = DESCRIPCIONES_CODIGOS[codigo]
        sheet1.getCell(`F${rowNum}`).value = PORCENTAJES_CODIGOS[codigo]
    })

    // Encabezados Tabla (Fila 12)
    const encabezadosHoja1 = ['CÉDULA', 'CONCEPTO', 'VALOR', 'SALDO', 'NIT', 'HORAS', 'MINUTOS']
    const titleRow = sheet1.getRow(12)
    encabezadosHoja1.forEach((enc, i) => {
        const cell = titleRow.getCell(i + 1)
        cell.value = enc
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } } // Azul
    })

    // Obtener datos (mismo periodo del reporte, filtrado en DB)
    // Para las horas dependemos de las vistas calculadas o de "cierres_quincenales" que vayas a implementar.
    // Simularemos la recolección si no hay vista de agrupación aún, usando la tabla de resúmenes o un Mock
    // ya que en V2 necesitas calcular las horas antes de imprimirlas.
    // NOTA VITAL: Aquí debes integrar tu función `calculoHoras.ts` o consultar los registros directos en Supabase.
    // Por motivos de migración 1:1, aquí construimos la plantilla visual y dejamos los datos preparados.

    // Obtener las horas reales pre-calculadas para todos los empleados en este periodo
    const { calcularHorasTodosUsuariosPorPeriodo } = await import('@/lib/calculoHoras')
    const resumenes = await calcularHorasTodosUsuariosPorPeriodo(fechaInicio, fechaFin)

    /**
     * Obtiene los registros de horas desglosados por tipo para un usuario
     */
    function obtenerRegistrosHoras(usuario: any) {
        const registros: any[] = []
        const tiposHoras = [
            { campoMinutos: 'extrasOrdinarias', campoValor: 'extrasOrdinarias', codigo: 11001 },
            { campoMinutos: 'extrasNocturnas', campoValor: 'extrasNocturnas', codigo: 11002 },
            { campoMinutos: 'extrasDominicalFestivo', campoValor: 'extrasDominicalFestivo', codigo: 11230 },
            { campoMinutos: 'extrasNocturnaDominicalFestivo', campoValor: 'extrasNocturnaDominicalFestivo', codigo: 11231 },
            { campoMinutos: 'nocturnas', campoValor: 'nocturnas', codigo: 11501 },
            { campoMinutos: 'festivos', campoValor: 'festivos', codigo: 11242 },
            { campoMinutos: 'domingosFestivosNocturnos', campoValor: 'domingosFestivosNocturnos', codigo: 11243 },
            { campoMinutos: 'domingos', campoValor: 'domingos', codigo: 11245 }
        ]

        const detalleMinutos = usuario.detalleMinutos || {}
        const detalleValores = usuario.detalleValores || {}

        tiposHoras.forEach(tipo => {
            const minutosTotal = detalleMinutos[tipo.campoMinutos] || 0
            if (minutosTotal > 0) {
                const horas = Math.floor(minutosTotal / 60)
                const minutos = minutosTotal % 60

                let valor = detalleValores[tipo.campoValor]
                if (valor === undefined || valor === null) {
                    const horasDecimales = minutosTotal / 60
                    const tarifa = TARIFAS_POR_DEFECTO[tipo.codigo] || 0
                    valor = Math.round(horasDecimales * tarifa * 100) / 100
                }

                registros.push({
                    concepto: tipo.codigo,
                    horas: horas,
                    minutos: minutos,
                    valor: Math.round(valor)
                })
            }
        })
        return registros
    }

    let filaActual = 13

    if (resumenes && resumenes.length > 0) {
        resumenes.forEach(user => {
            const registrosHoras = obtenerRegistrosHoras(user)
            registrosHoras.forEach(registro => {
                sheet1.getCell(`A${filaActual}`).value = user.cedula
                sheet1.getCell(`B${filaActual}`).value = registro.concepto
                sheet1.getCell(`C${filaActual}`).value = registro.valor
                sheet1.getCell(`D${filaActual}`).value = '' // SALDO (vacío)
                sheet1.getCell(`E${filaActual}`).value = '' // NIT (vacío)
                sheet1.getCell(`F${filaActual}`).value = registro.horas
                sheet1.getCell(`G${filaActual}`).value = registro.minutos
                filaActual++
            })
        })
    }

    // Ancho de columnas Sheet1
    sheet1.getColumn('A').width = 25
    sheet1.getColumn('B').width = 20
    sheet1.getColumn('C').width = 15
    sheet1.getColumn('D').width = 12
    sheet1.getColumn('E').width = 38
    sheet1.getColumn('F').width = 15
    sheet1.getColumn('G').width = 15

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

    if (resumenes && resumenes.length > 0) {
        resumenes.forEach(user => {
            const registrosHoras = obtenerRegistrosHoras(user)
            registrosHoras.forEach(registro => {
                sheet2.getCell(`A${filaActualH2}`).value = registro.concepto
                sheet2.getCell(`B${filaActualH2}`).value = user.cedula
                sheet2.getCell(`C${filaActualH2}`).value = fInicioStr
                sheet2.getCell(`D${filaActualH2}`).value = fFinStr
                sheet2.getCell(`E${filaActualH2}`).value = fInicioStr
                sheet2.getCell(`F${filaActualH2}`).value = documentoSoporte
                sheet2.getCell(`G${filaActualH2}`).value = registro.valor
                sheet2.getCell(`H${filaActualH2}`).value = periodicidadHoja2
                sheet2.getCell(`I${filaActualH2}`).value = ''
                sheet2.getCell(`J${filaActualH2}`).value = ''
                sheet2.getCell(`K${filaActualH2}`).value = registro.horas
                sheet2.getCell(`L${filaActualH2}`).value = registro.minutos
                sheet2.getCell(`M${filaActualH2}`).value = 'Ocasional'
                filaActualH2++
            })
        })
    }

    sheet2.getColumn('A').width = 12
    sheet2.getColumn('B').width = 12
    sheet2.getColumn('C').width = 15
    sheet2.getColumn('D').width = 15
    sheet2.getColumn('E').width = 15
    sheet2.getColumn('F').width = 18
    sheet2.getColumn('G').width = 12
    sheet2.getColumn('M').width = 15

    // Escribir a Buffer
    const buffer = await workbook.xlsx.writeBuffer()
    return buffer as ArrayBuffer
}

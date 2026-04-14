import { NextResponse } from 'next/server'
import { calcularHorasTodosUsuariosPorPeriodo } from '@/lib/calculoHoras'
import { getUserProfile } from '@/lib/auth'
import * as xlsx from 'xlsx'

export async function GET(request: Request) {
    try {
        const profile = await getUserProfile()
        if (!profile) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)

        let start = new Date()
        let end = new Date()

        const periodo = searchParams.get('periodo')
        const startParam = searchParams.get('start')
        const endParam = searchParams.get('end')

        if (periodo === 'personalizado' && startParam && endParam) {
            start = new Date(startParam)
            end = new Date(endParam)
        } else {
            const mes = searchParams.has('mes') ? parseInt(searchParams.get('mes') as string) : new Date().getMonth()
            const anio = searchParams.has('anio') ? parseInt(searchParams.get('anio') as string) : new Date().getFullYear()

            start = new Date(anio, mes, 1)

            if (periodo === 'quincenal' || !periodo) {
                // Al exportar todo quincena lo envia plano como mes.
                end = new Date(anio, mes + 1, 0, 23, 59, 59, 999)
            } else {
                end = new Date(anio, mes + 1, 0, 23, 59, 59, 999)
            }
        }

        end.setHours(23, 59, 59, 999)

        // Coordinador: forzar su operacion. Admin: respetar param.
        const opParam = searchParams.get('op')
        const operaciones = profile.rol === 'coordinador' && profile.operacion_nombre
            ? [profile.operacion_nombre]
            : (opParam ? opParam.split(',') : [])

        const datos = await calcularHorasTodosUsuariosPorPeriodo(start, end, operaciones)

        // Transform data for Excel
        const excelData = datos.map((row: any) => ({
            'Cédula': row.cedula,
            'Nombre': row.nombre,
            'Horas Totales (Formato)': row.horasTotalesFormato,
            'Minutos Totales': row.totalMinutos,
            'Horas Normales': row.horasFormato.normales,
            'Extras Ordinarias': row.horasFormato.extrasOrdinarias,
            'Extras Nocturnas': row.horasFormato.extrasNocturnas,
            'Nocturnas': row.horasFormato.nocturnas,
            'Domingos': row.horasFormato.domingos,
            'Festivos': row.horasFormato.festivos,
            'Domingos/Festivos Nocturnos': row.horasFormato.domingosFestivosNocturnos,
            'Extras Dominical/Festivo': row.horasFormato.extrasDominicalFestivo,
            'Ex. Nocturna Domin/Festivo': row.horasFormato.extrasNocturnaDominicalFestivo,
            'Total a Pagar': row.valorTotal
        }))

        const workbook = xlsx.utils.book_new()
        const worksheet = xlsx.utils.json_to_sheet(excelData)

        // Auto-size columns logic
        const max_width = excelData.reduce((w, r) => Math.max(w, r.Nombre.length), 10)
        worksheet["!cols"] = [
            { wch: 15 }, // Cedula
            { wch: max_width + 5 }, // Nombre
            { wch: 20 }, // Horas
            { wch: 15 },
            // ... and so on
        ]

        xlsx.utils.book_append_sheet(workbook, worksheet, 'Reporte de Horas')

        // Generate buffer
        const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' })

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Disposition': `attachment; filename="Reporte_Inlotrans_${start.toISOString().split('T')[0]}_al_${end.toISOString().split('T')[0]}.xlsx"`,
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            }
        })

    } catch (error) {
        console.error('Error generando excel:', error)
        return NextResponse.json({ error: 'Error generando reporte excel' }, { status: 500 })
    }
}

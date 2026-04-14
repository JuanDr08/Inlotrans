import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/auth'
import { generarExcelExtras } from '@/lib/excel/extras'
import { generarExcelAusentismos } from '@/lib/excel/ausentismos'
import { generarExcelAuxilios } from '@/lib/excel/auxilios'
import { generarExcelIncapacidades } from '@/lib/excel/incapacidades'

export async function GET(request: Request) {
    try {
        const profile = await getUserProfile()
        if (!profile) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const tipoPlan = searchParams.get('tipoPlan')
        const mesStr = searchParams.get('mes')
        const anioStr = searchParams.get('anio')

        let quincena = searchParams.get('quincena')

        // Si no mandan quincena pero mandan periodo, deducirlo
        // El admin V1 asume 1 y 2 en vez de 1Q / 2Q, adaptamos:
        const periodo = searchParams.get('periodo')
        if (periodo && !quincena) {
            quincena = periodo === '2' ? '2Q' : '1Q'
        } else if (!quincena) {
            quincena = '1Q'
        }

        if (!tipoPlan || !mesStr || !anioStr) {
            return NextResponse.json({ error: 'Faltan parámetros obligatorios: tipoPlan, mes, anio' }, { status: 400 })
        }

        const mesIndex = parseInt(mesStr, 10)
        let anio = parseInt(anioStr, 10)

        const supabase = await createClient()

        let buffer: ArrayBuffer

        console.log(`[Exportar Planos] Generando ${tipoPlan} para ${quincena} - mesIndex ${mesIndex} anio ${anio}`)

        switch (tipoPlan) {
            case 'extras':
                buffer = await generarExcelExtras(supabase, { quincena, mes: mesIndex, anio })
                break
            case 'ausentismos':
                buffer = await generarExcelAusentismos(supabase, { quincena, mes: mesIndex, anio })
                break
            case 'auxilios':
                buffer = await generarExcelAuxilios(supabase, { quincena, mes: mesIndex, anio })
                break
            case 'incapacidades':
                buffer = await generarExcelIncapacidades(supabase, { quincena, mes: mesIndex, anio })
                break
            default:
                return NextResponse.json({ error: 'Tipo de plano no soportado' }, { status: 400 })
        }

        // Devolver el archivo como binario (.xlsx)
        return new NextResponse(buffer, {
            headers: {
                'Content-Disposition': `attachment; filename="PLANO_${tipoPlan.toUpperCase()}_HOJAS_${mesIndex + 1}_${anio}.xlsx"`,
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            }
        })
    } catch (error) {
        console.error('Error generando plano Excel:', error)
        return NextResponse.json({ error: 'Error interno generando plano Excel' }, { status: 500 })
    }
}

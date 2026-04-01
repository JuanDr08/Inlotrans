import { createClient } from '@/lib/supabase/server'

// ==================================================
// CACHÉ DE DÍAS FESTIVOS
// ==================================================
interface CacheFestivo {
    fechas: Date[]
    timestamp: number
}
const cacheDiasFestivos: Record<number, CacheFestivo> = {}
const CACHE_FESTIVOS_DURACION = 24 * 60 * 60 * 1000 // 24 horas

// ==================================================
// CACHÉ DE TARIFAS
// ==================================================
let cacheTarifas: Record<string, number> | null = null
let cacheTarifasTimestamp: number | null = null
const CACHE_TARIFAS_DURACION = 5 * 60 * 1000 // 5 minutos

// ==================================================
// FUNCIONES DE PRECISIÓN PARA CÁLCULOS
// ==================================================
export function minutosAHoras(minutos: number): number {
    if (!minutos || minutos === 0) return 0
    return Math.round((minutos / 60) * 10000) / 10000
}

export function calcularValorPorMinutos(minutos: number, tarifaPorHora: number): number {
    if (!minutos || minutos === 0 || !tarifaPorHora) return 0
    const horas = minutos / 60
    const valorBruto = horas * tarifaPorHora
    return Math.round(valorBruto * 100) / 100
}

export function horasAFormato(horas: number): string {
    if (!horas || horas === 0) return "0:00"
    const horasEnteras = Math.floor(horas)
    const minutosDecimales = horas - horasEnteras
    const minutos = Math.round(minutosDecimales * 60)
    return `${horasEnteras}:${minutos.toString().padStart(2, '0')}`
}

export function calcularPorcentajeHora(minutos: number): number {
    if (!minutos || minutos === 0) return 0
    return Math.round((minutos / 60) * 100 * 100) / 100
}

async function obtenerDiasFestivos(año: number): Promise<Date[]> {
    if (cacheDiasFestivos[año] && cacheDiasFestivos[año].timestamp) {
        const tiempoTranscurrido = Date.now() - cacheDiasFestivos[año].timestamp
        if (tiempoTranscurrido < CACHE_FESTIVOS_DURACION) {
            return cacheDiasFestivos[año].fechas
        }
    }

    try {
        const response = await fetch(`https://api-colombia.com/api/v1/Holiday/year/${año}`)
        if (!response.ok) throw new Error(`Error en API festivos: ${response.status}`)
        const data = await response.json()

        const fechasFestivas = data.map((festivo: any) => {
            const fecha = new Date(festivo.date)
            return new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()))
        })

        cacheDiasFestivos[año] = { fechas: fechasFestivas, timestamp: Date.now() }
        return fechasFestivas
    } catch (error) {
        console.error(`Error al obtener días festivos para ${año}:`, error)
        return []
    }
}

// ==================================================
// MANEJO DE ZONAS HORARIAS (UTC a COLOMBIA UTC-5)
// ==================================================

/**
 * Convierte cualquier fecha a un Date "falso" donde sus métodos getUTC*
 * devuelven exactamente la hora local de Colombia.
 * La BD guarda en UTC (Z), Vercel corre en UTC. Al restar 5 horas,
 * garantizamos que getUTCHours() retorna la hora en Bogotá.
 */
function toColombiaTime(fechaUTC: Date | string): Date {
    const d = new Date(fechaUTC)
    const offsetBogota = -5 * 60 * 60 * 1000
    return new Date(d.getTime() + offsetBogota)
}

function esHorarioNocturno(fechaBogota: Date): boolean {
    const hora = fechaBogota.getUTCHours() // Usar siempre getUTC* en la fecha "falsa"
    return hora >= 19 || hora < 6
}

function esDomingoOFestivo(fechaBogota: Date, diasFestivos: Date[]): { isDomingo: boolean, isFestivo: boolean } {
    const isDomingo = fechaBogota.getUTCDay() === 0
    // Normalizamos la fecha consultada al inicio del día UTC
    const fechaNormalizada = new Date(Date.UTC(fechaBogota.getUTCFullYear(), fechaBogota.getUTCMonth(), fechaBogota.getUTCDate()))
    const isFestivo = diasFestivos.some(festivo => festivo.getTime() === fechaNormalizada.getTime())
    return { isDomingo, isFestivo }
}

async function obtenerTarifas(): Promise<Record<string, number>> {
    if (cacheTarifas && cacheTarifasTimestamp) {
        const tiempoTranscurrido = Date.now() - cacheTarifasTimestamp
        if (tiempoTranscurrido < CACHE_TARIFAS_DURACION) {
            return cacheTarifas
        }
    }

    try {
        const supabase = await createClient()
        const { data: rows, error } = await supabase
            .from('tarifas')
            .select('tipo_hora, precio_por_hora')
            .eq('activo', true)

        if (error) throw error

        const tarifas: Record<string, number> = {}
        rows.forEach(row => {
            tarifas[row.tipo_hora] = parseFloat(row.precio_por_hora)
        })

        cacheTarifas = tarifas
        cacheTarifasTimestamp = Date.now()
        return tarifas
    } catch (error) {
        console.error('Error al obtener tarifas:', error)
        return {
            normal: 7959,
            nocturno: 10745,
            extra: 9948,
            extraNocturno: 13928,
            domingo: 14326,
            festivo: 14326,
            domingoFestivoNocturno: 17111,
            extraDominicalFestivo: 17111,
            extraNocturnaDominicalFestivo: 21091
        }
    }
}

function calcularPeriodosHoras(entradaBogota: Date, salidaBogota: Date, diasFestivos: Date[]) {
    const resultado = {
        totalMinutos: 0,
        minutosNormales: 0,
        minutosExtrasOrdinarias: 0,
        minutosExtrasNocturnas: 0,
        minutosNocturnas: 0,
        minutosDomingos: 0,
        minutosFestivos: 0,
        minutosDomingosFestivosNocturnos: 0,
        minutosExtrasDominicalFestivo: 0,
        minutosExtrasNocturnaDominicalFestivo: 0,
        periodos: [] as any[]
    }

    const diffMs = salidaBogota.getTime() - entradaBogota.getTime()
    const totalMinutos = Math.floor(diffMs / (1000 * 60))
    resultado.totalMinutos = totalMinutos

    if (totalMinutos <= 0) return resultado

    let minutosAcumulados = 0
    let periodoActual: any = null

    for (let i = 0; i < totalMinutos; i++) {
        const momentoActual = new Date(entradaBogota.getTime() + i * 60 * 1000)
        const esNocturno = esHorarioNocturno(momentoActual)

        const inicioDia = new Date(momentoActual)
        inicioDia.setUTCHours(0, 0, 0, 0)
        const { isDomingo: esDiaDomingo, isFestivo: esDiaFestivo } = esDomingoOFestivo(inicioDia, diasFestivos)

        const esExtra = minutosAcumulados >= (8 * 60)
        let tipoMinuto

        if (esDiaDomingo || esDiaFestivo) {
            if (esExtra) {
                tipoMinuto = esNocturno ? 'extraNocturnaDominicalFestivo' : 'extraDominicalFestivo'
            } else {
                if (esNocturno) {
                    tipoMinuto = 'domingoFestivoNocturno'
                } else {
                    tipoMinuto = esDiaDomingo ? 'domingo' : 'festivo'
                }
            }
        } else if (esExtra) {
            tipoMinuto = esNocturno ? 'extraNocturno' : 'extra'
        } else {
            tipoMinuto = esNocturno ? 'nocturno' : 'normal'
        }

        switch (tipoMinuto) {
            case 'normal': resultado.minutosNormales++; break;
            case 'extra': resultado.minutosExtrasOrdinarias++; break;
            case 'extraNocturno': resultado.minutosExtrasNocturnas++; break;
            case 'nocturno': resultado.minutosNocturnas++; break;
            case 'domingo': resultado.minutosDomingos++; break;
            case 'festivo': resultado.minutosFestivos++; break;
            case 'domingoFestivoNocturno': resultado.minutosDomingosFestivosNocturnos++; break;
            case 'extraDominicalFestivo': resultado.minutosExtrasDominicalFestivo++; break;
            case 'extraNocturnaDominicalFestivo': resultado.minutosExtrasNocturnaDominicalFestivo++; break;
        }

        if (!periodoActual || periodoActual.tipo !== tipoMinuto) {
            if (periodoActual) resultado.periodos.push(periodoActual)
            periodoActual = {
                tipo: tipoMinuto,
                inicio: new Date(momentoActual),
                fin: new Date(momentoActual.getTime() + 60 * 1000),
                minutos: 1
            }
        } else {
            periodoActual.fin = new Date(momentoActual.getTime() + 60 * 1000)
            periodoActual.minutos++
        }
        minutosAcumulados++
    }

    if (periodoActual) resultado.periodos.push(periodoActual)
    return resultado
}

export async function calcularHorasUsuarioPorPeriodo(cedula: string, fechaInicio: Date, fechaFin: Date) {
    try {
        const supabase = await createClient()
        const { data: registros, error } = await supabase
            .from('registros')
            .select('id, usuario_nombre, operacion, tipo, fecha_hora')
            .eq('id', cedula)
            .gte('fecha_hora', fechaInicio.toISOString())
            .lte('fecha_hora', fechaFin.toISOString())
            .order('fecha_hora', { ascending: true })

        if (error) throw error
        if (!registros || registros.length === 0) return null

        const usuario = {
            cedula,
            nombre: registros[0].usuario_nombre,
            operacion: registros[0].operacion
        }

        const añoInicio = fechaInicio.getFullYear()
        const añoFin = fechaFin.getFullYear()
        let diasFestivos = await obtenerDiasFestivos(añoInicio)
        if (añoFin !== añoInicio) {
            const festivosAñoFin = await obtenerDiasFestivos(añoFin)
            diasFestivos = [...diasFestivos, ...festivosAñoFin]
        }

        const registrosUnicos: any[] = []
        const vistos = new Set()
        for (const registro of registros) {
            const key = `${registro.tipo}-${new Date(registro.fecha_hora).getTime()}`
            if (!vistos.has(key)) {
                vistos.add(key)
                registrosUnicos.push(registro)
            }
        }

        const pares = []
        const entradasAbiertas = []

        for (const registro of registrosUnicos) {
            if (registro.tipo === 'ENTRADA') {
                entradasAbiertas.push(registro)
            } else if (registro.tipo === 'SALIDA') {
                if (entradasAbiertas.length > 0) {
                    const entrada = entradasAbiertas.shift()
                    pares.push({ entrada, salida: registro })
                }
            }
        }

        let totalMinutos = 0, minutosNormales = 0, minutosExtrasOrdinarias = 0, minutosExtrasNocturnas = 0
        let minutosNocturnas = 0, minutosDomingos = 0, minutosFestivos = 0, minutosDomingosFestivosNocturnos = 0
        let minutosExtrasDominicalFestivo = 0, minutosExtrasNocturnaDominicalFestivo = 0

        const registrosCalculados = []
        for (const par of pares) {
            const entrada = toColombiaTime(par.entrada.fecha_hora)
            const salida = toColombiaTime(par.salida.fecha_hora)
            const periodos = calcularPeriodosHoras(entrada, salida, diasFestivos)

            totalMinutos += periodos.totalMinutos
            minutosNormales += periodos.minutosNormales
            minutosExtrasOrdinarias += periodos.minutosExtrasOrdinarias
            minutosExtrasNocturnas += periodos.minutosExtrasNocturnas
            minutosNocturnas += periodos.minutosNocturnas
            minutosDomingos += periodos.minutosDomingos
            minutosFestivos += periodos.minutosFestivos
            minutosDomingosFestivosNocturnos += periodos.minutosDomingosFestivosNocturnos
            minutosExtrasDominicalFestivo += periodos.minutosExtrasDominicalFestivo
            minutosExtrasNocturnaDominicalFestivo += periodos.minutosExtrasNocturnaDominicalFestivo

            registrosCalculados.push({
                entrada: entrada.toISOString(),
                salida: salida.toISOString(),
                horasCalculadas: periodos
            })
        }

        const tarifas = await obtenerTarifas()
        const valorNormales = calcularValorPorMinutos(minutosNormales, tarifas.normal)
        const valorExtrasOrdinarias = calcularValorPorMinutos(minutosExtrasOrdinarias, tarifas.extra)
        const valorExtrasNocturnas = calcularValorPorMinutos(minutosExtrasNocturnas, tarifas.extraNocturno)
        const valorNocturnas = calcularValorPorMinutos(minutosNocturnas, tarifas.nocturno)
        const valorDomingos = calcularValorPorMinutos(minutosDomingos, tarifas.domingo)
        const valorFestivos = calcularValorPorMinutos(minutosFestivos, tarifas.festivo)
        const valorDomingosFestivosNocturnos = calcularValorPorMinutos(minutosDomingosFestivosNocturnos, tarifas.domingoFestivoNocturno)
        const valorExtrasDominicalFestivo = calcularValorPorMinutos(minutosExtrasDominicalFestivo, tarifas.extraDominicalFestivo)
        const valorExtrasNocturnaDominicalFestivo = calcularValorPorMinutos(minutosExtrasNocturnaDominicalFestivo, tarifas.extraNocturnaDominicalFestivo)

        const valorTotal = Math.round((
            valorNormales + valorExtrasOrdinarias + valorExtrasNocturnas +
            valorNocturnas + valorDomingos + valorFestivos + valorDomingosFestivosNocturnos +
            valorExtrasDominicalFestivo + valorExtrasNocturnaDominicalFestivo
        ) * 100) / 100

        return {
            ...usuario,
            periodo: { inicio: fechaInicio.toISOString(), fin: fechaFin.toISOString() },
            totalMinutos,
            horasTotales: minutosAHoras(totalMinutos),
            horasTotalesFormato: horasAFormato(minutosAHoras(totalMinutos)),
            detalleMinutos: {
                normales: minutosNormales,
                extrasOrdinarias: minutosExtrasOrdinarias,
                extrasNocturnas: minutosExtrasNocturnas,
                nocturnas: minutosNocturnas,
                domingos: minutosDomingos,
                festivos: minutosFestivos,
                domingosFestivosNocturnos: minutosDomingosFestivosNocturnos,
                extrasDominicalFestivo: minutosExtrasDominicalFestivo,
                extrasNocturnaDominicalFestivo: minutosExtrasNocturnaDominicalFestivo
            },
            horasFormato: {
                normales: horasAFormato(minutosAHoras(minutosNormales)),
                extrasOrdinarias: horasAFormato(minutosAHoras(minutosExtrasOrdinarias)),
                extrasNocturnas: horasAFormato(minutosAHoras(minutosExtrasNocturnas)),
                nocturnas: horasAFormato(minutosAHoras(minutosNocturnas)),
                domingos: horasAFormato(minutosAHoras(minutosDomingos)),
                festivos: horasAFormato(minutosAHoras(minutosFestivos)),
                domingosFestivosNocturnos: horasAFormato(minutosAHoras(minutosDomingosFestivosNocturnos)),
                extrasDominicalFestivo: horasAFormato(minutosAHoras(minutosExtrasDominicalFestivo)),
                extrasNocturnaDominicalFestivo: horasAFormato(minutosAHoras(minutosExtrasNocturnaDominicalFestivo))
            },
            valorTotal,
            detalleValores: {
                normal: valorNormales,
                extrasOrdinarias: valorExtrasOrdinarias,
                extrasNocturnas: valorExtrasNocturnas,
                nocturnas: valorNocturnas,
                domingos: valorDomingos,
                festivos: valorFestivos,
                domingosFestivosNocturnos: valorDomingosFestivosNocturnos,
                extrasDominicalFestivo: valorExtrasDominicalFestivo,
                extrasNocturnaDominicalFestivo: valorExtrasNocturnaDominicalFestivo
            },
            registros: registrosCalculados
        }
    } catch (error) {
        console.error(`Error al calcular horas para usuario ${cedula}:`, error)
        throw error
    }
}

export async function calcularHorasTodosUsuariosPorPeriodo(fechaInicio: Date, fechaFin: Date, operaciones: string[] = []) {
    try {
        const supabase = await createClient()

        let query = supabase
            .from('registros')
            .select('id, usuario_nombre, operacion')
            .gte('fecha_hora', fechaInicio.toISOString())
            .lte('fecha_hora', fechaFin.toISOString())

        if (operaciones.length > 0) {
            query = query.in('operacion', operaciones)
        }

        const { data: records, error } = await query

        if (error) throw error

        // Identify unique users mapping their latest names and operations
        const uniqueUsersMap: Record<string, { id: string; usuario_nombre: string; operacion: string }> = {}

        records?.forEach((rec) => {
            uniqueUsersMap[rec.id] = {
                id: rec.id,
                usuario_nombre: rec.usuario_nombre,
                operacion: rec.operacion
            }
        })

        const usuarios = Object.values(uniqueUsersMap)

        // Process in parallel
        const promesas = usuarios.map(u => calcularHorasUsuarioPorPeriodo(u.id, fechaInicio, fechaFin))
        const resultados = await Promise.all(promesas)

        // Filter nulls (those missing valid entries/outputs)
        return resultados.filter(d => d !== null)

    } catch (error) {
        console.error('Error al calcular horas globales:', error)
        throw error
    }
}

// ==================================================
// MOTOR DE CÁLCULO OPTIMIZADO (TRAMOS Y BATCH QUERY)
// ==================================================

export function calcularPeriodosHorasOptimizado(entradaBogota: Date, salidaBogota: Date, diasFestivos: Date[]) {
    const resultado = {
        totalMinutos: 0,
        minutosNormales: 0,
        minutosExtrasOrdinarias: 0,
        minutosExtrasNocturnas: 0,
        minutosNocturnas: 0,
        minutosDomingos: 0,
        minutosFestivos: 0,
        minutosDomingosFestivosNocturnos: 0,
        minutosExtrasDominicalFestivo: 0,
        minutosExtrasNocturnaDominicalFestivo: 0,
        periodos: [] as any[]
    };

    const diffMs = salidaBogota.getTime() - entradaBogota.getTime();
    const totalMinutos = Math.floor(diffMs / (1000 * 60));
    resultado.totalMinutos = totalMinutos;

    if (totalMinutos <= 0) return resultado;

    let minutosAcumulados = 0;
    let momentoActualMs = entradaBogota.getTime();

    while (minutosAcumulados < totalMinutos) {
        const momentoActual = new Date(momentoActualMs);
        const horaUTC = momentoActual.getUTCHours();
        
        let minutosHastaCambioHorario = 0;
        if (horaUTC >= 6 && horaUTC < 19) {
            const next19 = new Date(momentoActual);
            next19.setUTCHours(19, 0, 0, 0);
            minutosHastaCambioHorario = Math.floor((next19.getTime() - momentoActual.getTime()) / 60000);
        } else if (horaUTC >= 19) {
            const nextMidnight = new Date(momentoActual);
            nextMidnight.setUTCHours(24, 0, 0, 0); 
            minutosHastaCambioHorario = Math.floor((nextMidnight.getTime() - momentoActual.getTime()) / 60000);
        } else {
            const next6 = new Date(momentoActual);
            next6.setUTCHours(6, 0, 0, 0);
            minutosHastaCambioHorario = Math.floor((next6.getTime() - momentoActual.getTime()) / 60000);
        }
        
        const minutosHastaExtra = minutosAcumulados < 480 ? (480 - minutosAcumulados) : Infinity;
        
        let chunkMinutos = Math.min(
            minutosHastaCambioHorario > 0 ? minutosHastaCambioHorario : 1,
            minutosHastaExtra,
            totalMinutos - minutosAcumulados
        );
        
        if (chunkMinutos <= 0) chunkMinutos = 1;

        const esNocturno = esHorarioNocturno(momentoActual);
        const inicioDia = new Date(momentoActual);
        inicioDia.setUTCHours(0, 0, 0, 0);
        const { isDomingo: esDiaDomingo, isFestivo: esDiaFestivo } = esDomingoOFestivo(inicioDia, diasFestivos);
        const esExtra = minutosAcumulados >= 480;
        
        let tipoMinuto;
        if (esDiaDomingo || esDiaFestivo) {
            if (esExtra) {
                tipoMinuto = esNocturno ? 'extraNocturnaDominicalFestivo' : 'extraDominicalFestivo';
            } else {
                if (esNocturno) {
                    tipoMinuto = 'domingoFestivoNocturno';
                } else {
                    tipoMinuto = esDiaDomingo ? 'domingo' : 'festivo';
                }
            }
        } else if (esExtra) {
            tipoMinuto = esNocturno ? 'extraNocturno' : 'extra';
        } else {
            tipoMinuto = esNocturno ? 'nocturno' : 'normal';
        }

        switch (tipoMinuto) {
            case 'normal': resultado.minutosNormales += chunkMinutos; break;
            case 'extra': resultado.minutosExtrasOrdinarias += chunkMinutos; break;
            case 'extraNocturno': resultado.minutosExtrasNocturnas += chunkMinutos; break;
            case 'nocturno': resultado.minutosNocturnas += chunkMinutos; break;
            case 'domingo': resultado.minutosDomingos += chunkMinutos; break;
            case 'festivo': resultado.minutosFestivos += chunkMinutos; break;
            case 'domingoFestivoNocturno': resultado.minutosDomingosFestivosNocturnos += chunkMinutos; break;
            case 'extraDominicalFestivo': resultado.minutosExtrasDominicalFestivo += chunkMinutos; break;
            case 'extraNocturnaDominicalFestivo': resultado.minutosExtrasNocturnaDominicalFestivo += chunkMinutos; break;
        }

        minutosAcumulados += chunkMinutos;
        momentoActualMs += chunkMinutos * 60000;
    }

    return resultado;
}

export async function calcularHorasTodosUsuariosPorPeriodoOptimizado(fechaInicio: Date, fechaFin: Date, operacionesGasto: string[] = []) {
    try {
        const supabase = await createClient();

        let query = supabase
            .from('registros')
            .select('id, usuario_nombre, operacion, tipo, fecha_hora')
            .gte('fecha_hora', fechaInicio.toISOString())
            .lte('fecha_hora', fechaFin.toISOString())
            .order('fecha_hora', { ascending: true });

        if (operacionesGasto.length > 0) {
            query = query.in('operacion', operacionesGasto);
        }

        const { data: registrosTotales, error } = await query;
        if (error) throw error;
        if (!registrosTotales || registrosTotales.length === 0) return [];

        const añoInicio = fechaInicio.getFullYear();
        const añoFin = fechaFin.getFullYear();
        let diasFestivos = await obtenerDiasFestivos(añoInicio);
        if (añoFin !== añoInicio) {
            const festivosAñoFin = await obtenerDiasFestivos(añoFin);
            diasFestivos = [...diasFestivos, ...festivosAñoFin];
        }
        const tarifas = await obtenerTarifas();

        const registrosPorUsuario: Record<string, any[]> = {};
        for (const reg of registrosTotales) {
            if (!registrosPorUsuario[reg.id]) {
                registrosPorUsuario[reg.id] = [];
            }
            registrosPorUsuario[reg.id].push(reg);
        }

        const resultadosFinales = [];

        for (const [cedula, registros] of Object.entries(registrosPorUsuario)) {
            const registrosUnicos: any[] = [];
            const vistos = new Set();
            for (const registro of registros) {
                const key = `${registro.tipo}-${new Date(registro.fecha_hora).getTime()}`;
                if (!vistos.has(key)) {
                    vistos.add(key);
                    registrosUnicos.push(registro);
                }
            }

            const pares = [];
            const entradasAbiertas = [];

            for (const registro of registrosUnicos) {
                if (registro.tipo === 'ENTRADA') {
                    entradasAbiertas.push(registro);
                } else if (registro.tipo === 'SALIDA') {
                    if (entradasAbiertas.length > 0) {
                        const entrada = entradasAbiertas.shift();
                        pares.push({ entrada, salida: registro });
                    }
                }
            }

            if (pares.length === 0) continue;

            const usuarioData = {
                cedula,
                nombre: registrosUnicos[registrosUnicos.length - 1].usuario_nombre,
                operacion: registrosUnicos[registrosUnicos.length - 1].operacion
            };

            let totalMinutos = 0, minutosNormales = 0, minutosExtrasOrdinarias = 0, minutosExtrasNocturnas = 0;
            let minutosNocturnas = 0, minutosDomingos = 0, minutosFestivos = 0, minutosDomingosFestivosNocturnos = 0;
            let minutosExtrasDominicalFestivo = 0, minutosExtrasNocturnaDominicalFestivo = 0;

            const registrosCalculados = [];
            for (const par of pares) {
                // Importante: toColombiaTime no es exportado. 
                // Ah, pero estamos dentro del archivo, así que podemos llamarlo libremente.
                const entrada = toColombiaTime(par.entrada.fecha_hora);
                const salida = toColombiaTime(par.salida.fecha_hora);
                const periodos = calcularPeriodosHorasOptimizado(entrada, salida, diasFestivos);

                totalMinutos += periodos.totalMinutos;
                minutosNormales += periodos.minutosNormales;
                minutosExtrasOrdinarias += periodos.minutosExtrasOrdinarias;
                minutosExtrasNocturnas += periodos.minutosExtrasNocturnas;
                minutosNocturnas += periodos.minutosNocturnas;
                minutosDomingos += periodos.minutosDomingos;
                minutosFestivos += periodos.minutosFestivos;
                minutosDomingosFestivosNocturnos += periodos.minutosDomingosFestivosNocturnos;
                minutosExtrasDominicalFestivo += periodos.minutosExtrasDominicalFestivo;
                minutosExtrasNocturnaDominicalFestivo += periodos.minutosExtrasNocturnaDominicalFestivo;

                registrosCalculados.push({
                    entrada: entrada.toISOString(),
                    salida: salida.toISOString(),
                    horasCalculadas: periodos
                });
            }

            const valorNormales = calcularValorPorMinutos(minutosNormales, tarifas.normal);
            const valorExtrasOrdinarias = calcularValorPorMinutos(minutosExtrasOrdinarias, tarifas.extra);
            const valorExtrasNocturnas = calcularValorPorMinutos(minutosExtrasNocturnas, tarifas.extraNocturno);
            const valorNocturnas = calcularValorPorMinutos(minutosNocturnas, tarifas.nocturno);
            const valorDomingos = calcularValorPorMinutos(minutosDomingos, tarifas.domingo);
            const valorFestivos = calcularValorPorMinutos(minutosFestivos, tarifas.festivo);
            const valorDomingosFestivosNocturnos = calcularValorPorMinutos(minutosDomingosFestivosNocturnos, tarifas.domingoFestivoNocturno);
            const valorExtrasDominicalFestivo = calcularValorPorMinutos(minutosExtrasDominicalFestivo, tarifas.extraDominicalFestivo);
            const valorExtrasNocturnaDominicalFestivo = calcularValorPorMinutos(minutosExtrasNocturnaDominicalFestivo, tarifas.extraNocturnaDominicalFestivo);

            const valorTotal = Math.round((
                valorNormales + valorExtrasOrdinarias + valorExtrasNocturnas +
                valorNocturnas + valorDomingos + valorFestivos + valorDomingosFestivosNocturnos +
                valorExtrasDominicalFestivo + valorExtrasNocturnaDominicalFestivo
            ) * 100) / 100;

            resultadosFinales.push({
                ...usuarioData,
                periodo: { inicio: fechaInicio.toISOString(), fin: fechaFin.toISOString() },
                totalMinutos,
                horasTotales: minutosAHoras(totalMinutos),
                horasTotalesFormato: horasAFormato(minutosAHoras(totalMinutos)),
                detalleMinutos: {
                    normales: minutosNormales,
                    extrasOrdinarias: minutosExtrasOrdinarias,
                    extrasNocturnas: minutosExtrasNocturnas,
                    nocturnas: minutosNocturnas,
                    domingos: minutosDomingos,
                    festivos: minutosFestivos,
                    domingosFestivosNocturnos: minutosDomingosFestivosNocturnos,
                    extrasDominicalFestivo: minutosExtrasDominicalFestivo,
                    extrasNocturnaDominicalFestivo: minutosExtrasNocturnaDominicalFestivo
                },
                horasFormato: {
                    normales: horasAFormato(minutosAHoras(minutosNormales)),
                    extrasOrdinarias: horasAFormato(minutosAHoras(minutosExtrasOrdinarias)),
                    extrasNocturnas: horasAFormato(minutosAHoras(minutosExtrasNocturnas)),
                    nocturnas: horasAFormato(minutosAHoras(minutosNocturnas)),
                    domingos: horasAFormato(minutosAHoras(minutosDomingos)),
                    festivos: horasAFormato(minutosAHoras(minutosFestivos)),
                    domingosFestivosNocturnos: horasAFormato(minutosAHoras(minutosDomingosFestivosNocturnos)),
                    extrasDominicalFestivo: horasAFormato(minutosAHoras(minutosExtrasDominicalFestivo)),
                    extrasNocturnaDominicalFestivo: horasAFormato(minutosAHoras(minutosExtrasNocturnaDominicalFestivo))
                },
                valorTotal,
                detalleValores: {
                    normal: valorNormales,
                    extrasOrdinarias: valorExtrasOrdinarias,
                    extrasNocturnas: valorExtrasNocturnas,
                    nocturnas: valorNocturnas,
                    domingos: valorDomingos,
                    festivos: valorFestivos,
                    domingosFestivosNocturnos: valorDomingosFestivosNocturnos,
                    extrasDominicalFestivo: valorExtrasDominicalFestivo,
                    extrasNocturnaDominicalFestivo: valorExtrasNocturnaDominicalFestivo
                },
                registros: registrosCalculados
            });
        }

        // Importante! Ordenar o la presentación puede variar
        return resultadosFinales;
    } catch (error) {
        console.error('Error al calcular horas globales optimizadas:', error);
        throw error;
    }
}

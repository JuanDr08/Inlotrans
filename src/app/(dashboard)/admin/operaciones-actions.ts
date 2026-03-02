'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'

// Interfaz para la operación
export type Operacion = {
    id: string
    nombre: string
    status: boolean
    created_at?: string
}

// 1. Fetch de todas las operaciones (Admin)
export async function getOperacionesAdmin() {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('operaciones')
        .select('*')
        .order('created_at', { ascending: true })

    if (error) {
        console.error('Error fetching operaciones (Admin):', error)
        return { success: false, error: error.message }
    }

    return { success: true, data: data as Operacion[] }
}

// 2. Fetch cacheado de operaciones activas (Kiosco)
// Usamos unstable_cache para cachear la respuesta en disco/memoria (revalida cada 5 minutos o cuando manualmente lo desees).
// The user asked for a "cache ligero".
export const getOperacionesActivas = unstable_cache(
    async () => {
        // Usamos el cliente anónimo público puro para evitar usar cookies() dentro de unstable_cache()
        const supabase = createSupabaseClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
        const { data, error } = await supabase
            .from('operaciones')
            .select('id, nombre')
            .eq('status', true)
            .order('nombre', { ascending: true })

        if (error) {
            console.error('Error fetching operaciones (Kiosco cacheado):', error)
            return { success: false, data: [] }
        }
        return { success: true, data: data as Pick<Operacion, 'id' | 'nombre'>[] }
    },
    ['operaciones-activas'],
    { revalidate: 300, tags: ['operaciones'] } // Cache de 5 minutos, y le asignamos un tag para forzar la revalidación si creamos una nueva
)

// 3. Crear o Actualizar
export async function upsertOperacion(operacion: Partial<Operacion>) {
    const supabase = await createClient()

    if (operacion.id) {
        // Es actualización
        const { error } = await supabase
            .from('operaciones')
            .update({ nombre: operacion.nombre, status: operacion.status })
            .eq('id', operacion.id)

        if (error) return { success: false, error: error.message }
    } else {
        // Es Inserción nueva
        // Validamos primero que no exista el nombre
        const { data: existente } = await supabase.from('operaciones').select('id').eq('nombre', operacion.nombre).single()
        if (existente) return { success: false, error: 'Ya existe una operación con ese nombre.' }

        const { error } = await supabase
            .from('operaciones')
            .insert({ nombre: operacion.nombre, status: operacion.status ?? true })

        if (error) return { success: false, error: error.message }
    }

    // Como cambiamos algo, forzamos a Next.js a botar la cache del Kiosco y de la página de admin
    const { revalidateTag } = await import('next/cache')
    revalidateTag('operaciones', 'max')

    return { success: true }
}

// 4. Eliminar
export async function deleteOperacion(id: string) {
    const supabase = await createClient()
    const { error } = await supabase
        .from('operaciones')
        .delete()
        .eq('id', id)

    if (error) return { success: false, error: error.message }

    const { revalidateTag } = await import('next/cache')
    revalidateTag('operaciones', 'max')

    return { success: true }
}

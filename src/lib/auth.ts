import { createClient } from '@/lib/supabase/server'

export type Rol = 'admin' | 'coordinador'

export type UserProfile = {
    userId: string
    email: string
    rol: Rol
    operacion_nombre: string | null
}

/**
 * Obtiene el perfil del usuario autenticado actual.
 * Retorna null si no hay sesion o si el usuario no tiene perfil en `perfiles`.
 */
export async function getUserProfile(): Promise<UserProfile | null> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    const { data: perfil } = await supabase
        .from('perfiles')
        .select('rol, operacion_nombre')
        .eq('id', user.id)
        .single()

    if (!perfil) return null

    return {
        userId: user.id,
        email: user.email!,
        rol: perfil.rol as Rol,
        operacion_nombre: perfil.operacion_nombre
    }
}

/**
 * Assertion: requiere que el perfil sea admin. Lanza error si no.
 */
export function requireAdmin(profile: UserProfile | null): asserts profile is UserProfile {
    if (!profile || profile.rol !== 'admin') {
        throw new Error('No autorizado: se requiere rol de administrador')
    }
}

/**
 * Assertion: requiere que el perfil sea admin o coordinador. Lanza error si no.
 */
export function requireAdminOrCoordinador(profile: UserProfile | null): asserts profile is UserProfile {
    if (!profile || !['admin', 'coordinador'].includes(profile.rol)) {
        throw new Error('No autorizado: se requiere rol de administrador o coordinador')
    }
}

/**
 * Retorna el filtro de operaciones para queries.
 * Admin: array vacio (sin filtro, ve todo).
 * Coordinador: [operacion_nombre] (filtro obligatorio).
 */
export function getOperationFilter(profile: UserProfile): string[] {
    if (profile.rol === 'admin') return []
    return profile.operacion_nombre ? [profile.operacion_nombre] : []
}

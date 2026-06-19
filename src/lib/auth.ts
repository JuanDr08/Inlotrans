'use server'

import { getSessionCookie, verifySession } from '@/lib/auth/session'
import { getD1 } from '@/lib/d1/client'

export type Rol = 'admin' | 'coordinador'

export type UserProfile = {
    userId: string
    email: string
    rol: Rol
    operacion_nombre: string | null
}

export async function getUserProfile(): Promise<UserProfile | null> {
    const token = await getSessionCookie()
    if (!token) return null

    const secret = process.env.AUTH_SECRET
    if (!secret) return null

    const session = await verifySession(token, secret)
    if (!session) return null

    const db = getD1()
    const perfil = await db
        .prepare('SELECT rol, operacion_nombre FROM perfiles WHERE id = ?')
        .bind(session.userId)
        .first<{ rol: string; operacion_nombre: string | null }>()

    if (!perfil) return null

    return {
        userId: session.userId,
        email: session.email,
        rol: perfil.rol as Rol,
        operacion_nombre: perfil.operacion_nombre,
    }
}

export function requireAdmin(profile: UserProfile | null): asserts profile is UserProfile {
    if (!profile || profile.rol !== 'admin') {
        throw new Error('No autorizado: se requiere rol de administrador')
    }
}

export function requireAdminOrCoordinador(profile: UserProfile | null): asserts profile is UserProfile {
    if (!profile || !['admin', 'coordinador'].includes(profile.rol)) {
        throw new Error('No autorizado: se requiere rol de administrador o coordinador')
    }
}

export function getOperationFilter(profile: UserProfile): string[] {
    if (profile.rol === 'admin') return []
    return profile.operacion_nombre ? [profile.operacion_nombre] : []
}

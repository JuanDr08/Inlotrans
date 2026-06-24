export type Rol = 'admin' | 'coordinador'

export type UserProfile = {
    userId: string
    email: string
    rol: Rol
    operacion_nombre: string | null
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

'use server'

import { getD1, generateId } from '@/lib/d1/client'
import { getUserProfile, requireAdmin } from '@/lib/auth'
import { hashPassword } from '@/lib/auth/password'
import { revalidatePath } from 'next/cache'

export type PerfilConEmail = {
    id: string
    email: string
    rol: string
    operacion_nombre: string | null
    created_at: string
    banned: boolean
}

export async function listarUsuarios(): Promise<{ success: boolean; data?: PerfilConEmail[]; error?: string }> {
    const profile = await getUserProfile()
    requireAdmin(profile)

    const db = getD1()

    interface PerfilRow {
        id: string
        rol: string
        operacion_nombre: string | null
        created_at: string
        email: string
        banned_until: string | null
    }

    const { results } = await db
        .prepare(`
            SELECT p.id, p.rol, p.operacion_nombre, p.created_at,
                   u.email, u.banned_until
            FROM perfiles p
            JOIN auth_users u ON u.id = p.id
            ORDER BY p.created_at ASC
        `)
        .all()

    const rows = (results ?? []) as unknown as PerfilRow[]

    const data: PerfilConEmail[] = rows.map(r => ({
        id: r.id,
        email: r.email,
        rol: r.rol,
        operacion_nombre: r.operacion_nombre,
        created_at: r.created_at,
        banned: r.banned_until ? new Date(r.banned_until) > new Date() : false,
    }))

    return { success: true, data }
}

export async function crearUsuarioAuth({
    email,
    password,
    rol,
    operacion_nombre,
}: {
    email: string
    password: string
    rol: 'admin' | 'coordinador'
    operacion_nombre: string | null
}): Promise<{ success: boolean; error?: string }> {
    const profile = await getUserProfile()
    requireAdmin(profile)

    if (!email || !password) {
        return { success: false, error: 'Email y password son obligatorios' }
    }

    if (password.length < 6) {
        return { success: false, error: 'La contraseña debe tener al menos 6 caracteres' }
    }

    if (rol === 'coordinador' && !operacion_nombre) {
        return { success: false, error: 'Un coordinador debe tener una operación asignada' }
    }

    const db = getD1()

    const existing = await db
        .prepare('SELECT id FROM auth_users WHERE email = ?')
        .bind(email.toLowerCase())
        .first()

    if (existing) {
        return { success: false, error: 'Ya existe un usuario con ese email' }
    }

    const id = generateId()
    const passwordHash = await hashPassword(password)

    const stmts = [
        db.prepare('INSERT INTO auth_users (id, email, password_hash) VALUES (?, ?, ?)')
            .bind(id, email.toLowerCase(), passwordHash),
        db.prepare('INSERT INTO perfiles (id, rol, operacion_nombre) VALUES (?, ?, ?)')
            .bind(id, rol, rol === 'admin' ? null : operacion_nombre),
    ]

    try {
        await db.batch(stmts)
    } catch (err) {
        return { success: false, error: 'Error creando usuario: ' + (err instanceof Error ? err.message : 'desconocido') }
    }

    revalidatePath('/admin/usuarios')
    return { success: true }
}

export async function editarPerfil({
    id,
    rol,
    operacion_nombre,
}: {
    id: string
    rol: 'admin' | 'coordinador'
    operacion_nombre: string | null
}): Promise<{ success: boolean; error?: string }> {
    const profile = await getUserProfile()
    requireAdmin(profile)

    if (rol === 'coordinador' && !operacion_nombre) {
        return { success: false, error: 'Un coordinador debe tener una operación asignada' }
    }

    const db = getD1()
    await db
        .prepare('UPDATE perfiles SET rol = ?, operacion_nombre = ? WHERE id = ?')
        .bind(rol, rol === 'admin' ? null : operacion_nombre, id)
        .run()

    revalidatePath('/admin/usuarios')
    return { success: true }
}

export async function toggleBanUsuario(id: string): Promise<{ success: boolean; error?: string }> {
    const profile = await getUserProfile()
    requireAdmin(profile)

    if (profile.userId === id) {
        return { success: false, error: 'No puedes desactivar tu propia cuenta' }
    }

    const db = getD1()
    const user = await db
        .prepare('SELECT banned_until FROM auth_users WHERE id = ?')
        .bind(id)
        .first<{ banned_until: string | null }>()

    if (!user) {
        return { success: false, error: 'Usuario no encontrado' }
    }

    const isBanned = user.banned_until ? new Date(user.banned_until) > new Date() : false
    const newBanUntil = isBanned ? null : new Date(Date.now() + 10 * 365.25 * 24 * 60 * 60 * 1000).toISOString()

    await db
        .prepare('UPDATE auth_users SET banned_until = ? WHERE id = ?')
        .bind(newBanUntil, id)
        .run()

    revalidatePath('/admin/usuarios')
    return { success: true }
}

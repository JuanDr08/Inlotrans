'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getD1, generateId } from '@/lib/d1/client'
import { hashPassword, verifyPassword } from '@/lib/auth/password'
import { createSession, setSessionCookie, deleteSessionCookie } from '@/lib/auth/session'

export async function login(formData: FormData) {
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    if (!email || !password) {
        redirect('/login?message=Email+y+contraseña+son+obligatorios')
    }

    const db = getD1()
    const user = await db
        .prepare('SELECT id, password_hash, banned_until FROM auth_users WHERE email = ?')
        .bind(email.toLowerCase())
        .first<{ id: string; password_hash: string; banned_until: string | null }>()

    if (!user) {
        redirect('/login?message=No+se+pudo+iniciar+sesion')
    }

    if (user.banned_until) {
        const banDate = new Date(user.banned_until)
        if (banDate > new Date()) {
            redirect('/login?message=Cuenta+desactivada')
        }
    }

    const valid = await verifyPassword(password, user.password_hash)
    if (!valid) {
        redirect('/login?message=No+se+pudo+iniciar+sesion')
    }

    const secret = process.env.AUTH_SECRET!
    const token = await createSession(user.id, email, secret)
    await setSessionCookie(token)

    revalidatePath('/', 'layout')
    redirect('/')
}

export async function signup(formData: FormData) {
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    if (!email || !password) {
        redirect('/login?message=Email+y+contraseña+son+obligatorios')
    }

    if (password.length < 6) {
        redirect('/login?message=La+contraseña+debe+tener+al+menos+6+caracteres')
    }

    const db = getD1()

    const existing = await db
        .prepare('SELECT id FROM auth_users WHERE email = ?')
        .bind(email.toLowerCase())
        .first()

    if (existing) {
        redirect('/login?message=Ya+existe+un+usuario+con+ese+email')
    }

    const id = generateId()
    const passwordHash = await hashPassword(password)

    await db
        .prepare('INSERT INTO auth_users (id, email, password_hash) VALUES (?, ?, ?)')
        .bind(id, email.toLowerCase(), passwordHash)
        .run()

    const secret = process.env.AUTH_SECRET!
    const token = await createSession(id, email, secret)
    await setSessionCookie(token)

    revalidatePath('/', 'layout')
    redirect('/')
}

export async function signout() {
    await deleteSessionCookie()
    redirect('/login')
}

/**
 * JWT session management using Web Crypto API (HMAC-SHA256).
 * Compatible with Cloudflare Workers — no jsonwebtoken/jose needed.
 */

import { cookies } from 'next/headers'

const SESSION_COOKIE = 'inlotrans-session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days in seconds

interface SessionPayload {
    userId: string
    email: string
    iat: number
    exp: number
}

function base64UrlEncode(data: string): string {
    return btoa(data).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(str: string): string {
    str = str.replace(/-/g, '+').replace(/_/g, '/')
    while (str.length % 4) str += '='
    return atob(str)
}

async function getKey(secret: string): Promise<CryptoKey> {
    const encoder = new TextEncoder()
    return crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify'],
    )
}

async function signJWT(payload: SessionPayload, secret: string): Promise<string> {
    const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    const body = base64UrlEncode(JSON.stringify(payload))
    const data = `${header}.${body}`

    const key = await getKey(secret)
    const encoder = new TextEncoder()
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data))
    const sig = base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)))

    return `${data}.${sig}`
}

async function verifyJWT(token: string, secret: string): Promise<SessionPayload | null> {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const [header, body, sig] = parts
    const data = `${header}.${body}`

    const key = await getKey(secret)
    const encoder = new TextEncoder()

    const sigBytes = Uint8Array.from(base64UrlDecode(sig), c => c.charCodeAt(0))
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(data))

    if (!valid) return null

    const payload: SessionPayload = JSON.parse(base64UrlDecode(body))

    if (payload.exp < Math.floor(Date.now() / 1000)) return null

    return payload
}

export async function createSession(userId: string, email: string, secret: string): Promise<string> {
    const now = Math.floor(Date.now() / 1000)
    const payload: SessionPayload = {
        userId,
        email,
        iat: now,
        exp: now + SESSION_MAX_AGE,
    }
    return signJWT(payload, secret)
}

export async function verifySession(token: string, secret: string): Promise<SessionPayload | null> {
    return verifyJWT(token, secret)
}

export async function setSessionCookie(token: string): Promise<void> {
    const cookieStore = await cookies()
    cookieStore.set(SESSION_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: SESSION_MAX_AGE,
    })
}

export async function getSessionCookie(): Promise<string | null> {
    const cookieStore = await cookies()
    return cookieStore.get(SESSION_COOKIE)?.value ?? null
}

export async function deleteSessionCookie(): Promise<void> {
    const cookieStore = await cookies()
    cookieStore.delete(SESSION_COOKIE)
}

export function getSessionFromRequest(request: Request): string | null {
    const cookieHeader = request.headers.get('cookie') ?? ''
    const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))
    return match?.[1] ?? null
}

export { SESSION_COOKIE, type SessionPayload }

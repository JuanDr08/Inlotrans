/**
 * Session middleware — replaces Supabase GoTrue session management.
 * Validates JWT from cookie, enforces RBAC on dashboard routes.
 *
 * NOTE: This middleware cannot access D1 directly (edge runtime limitation
 * with some adapters). It validates the JWT signature only. The perfiles
 * lookup for RBAC is done via a lightweight fetch to an internal endpoint
 * or skipped in favor of app-level checks in Server Components/Actions.
 *
 * For now, the middleware only validates authentication (is the JWT valid?).
 * Role-based route gating is handled by Server Components that call getUserProfile().
 */

import { NextResponse, type NextRequest } from 'next/server'
import { verifySession, getSessionFromRequest, SESSION_COOKIE } from '@/lib/auth/session'

const ADMIN_ONLY_ROUTES = ['/admin/operaciones', '/admin/usuarios']

function isDashboardRoute(pathname: string): boolean {
    return pathname.startsWith('/empleados')
        || pathname.startsWith('/novedades')
        || pathname.startsWith('/admin')
        || pathname.startsWith('/aprobaciones')
}

export async function updateSession(request: NextRequest) {
    const pathname = request.nextUrl.pathname
    const isAuthRoute = pathname.startsWith('/login')
    const isCronRoute = pathname.startsWith('/api/cron')
    const isApiReportes = pathname.startsWith('/api/reportes')

    // Cron and report routes handle their own auth
    if (isCronRoute || isApiReportes) {
        return NextResponse.next()
    }

    const token = getSessionFromRequest(request)
    const secret = process.env.AUTH_SECRET

    let session = null
    if (token && secret) {
        session = await verifySession(token, secret)
    }

    // Not authenticated: redirect to login (except login page itself)
    if (!session && !isAuthRoute) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
    }

    // Authenticated trying to access login: redirect to kiosk
    if (session && isAuthRoute) {
        const url = request.nextUrl.clone()
        url.pathname = '/'
        return NextResponse.redirect(url)
    }

    return NextResponse.next()
}

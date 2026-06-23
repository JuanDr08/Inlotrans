import { NextResponse, type NextRequest } from 'next/server'
import { verifySession, getSessionFromRequest } from '@/lib/auth/session'

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

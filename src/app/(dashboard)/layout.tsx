import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { signout } from '@/app/login/actions'
import {
    Users,
    Settings,
    Clock,
    LogOut,
    FileText
} from 'lucide-react'

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // TODO: Fetch user role from profile table later to restrict views
    // const role = await getUserRole(user.id)

    return (
        <div className="flex min-h-screen bg-slate-50/40">
            {/* Sidebar - Ocultable en móvil próximamente */}
            <aside className="w-64 border-r bg-white p-4 hidden md:flex flex-col gap-4">
                <div className="flex h-14 items-center font-bold text-xl px-2">
                    Inlotrans
                </div>
                <nav className="flex-1 space-y-2">
                    <Link href="/">
                        <Button variant="ghost" className="w-full justify-start gap-2">
                            <Clock className="h-4 w-4" />
                            Asistencia Web
                        </Button>
                    </Link>
                    <Link href="/empleados">
                        <Button variant="ghost" className="w-full justify-start gap-2">
                            <Users className="h-4 w-4" />
                            Empleados
                        </Button>
                    </Link>
                    <Link href="/novedades">
                        <Button variant="ghost" className="w-full justify-start gap-2">
                            <FileText className="h-4 w-4" />
                            Novedades
                        </Button>
                    </Link>
                    <Link href="/admin">
                        <Button variant="ghost" className="w-full justify-start gap-2">
                            <Settings className="h-4 w-4" />
                            Administración
                        </Button>
                    </Link>
                </nav>
                <div className="border-t pt-4">
                    <p className="text-sm font-medium px-2 truncate mb-2 text-slate-500">
                        {user.email}
                    </p>
                    <form action={signout}>
                        <Button variant="outline" className="w-full justify-start gap-2 text-red-500 hover:text-red-600 hover:bg-red-50">
                            <LogOut className="h-4 w-4" />
                            Cerrar Sesión
                        </Button>
                    </form>
                </div>
            </aside>

            {/* Main content */}
            <main className="flex-1 overflow-y-auto">
                <div className="container mx-auto p-4 md:p-8">
                    {children}
                </div>
            </main>
        </div>
    )
}

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default async function DashboardPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Bienvenido al Checador</h1>
                <p className="text-muted-foreground mt-2">
                    Registros en tiempo real de entradas y salidas.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Activos Hoy</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">0</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Horas Extras</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">0 hrs</div>
                    </CardContent>
                </Card>
            </div>

            {/* Componente futuro: Tabla de últimos movimientos */}
        </div>
    )
}

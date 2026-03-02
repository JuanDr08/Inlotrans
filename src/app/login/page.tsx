import { login, signup } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
    return (
        <div className="flex h-screen w-full items-center justify-center px-4">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle className="text-2xl">Inlotrans</CardTitle>
                    <CardDescription>Ingresa tus credenciales para acceder al sistema.</CardDescription>
                </CardHeader>
                <form>
                    <CardContent className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="email">Correo electrónico</Label>
                            <Input id="email" name="email" type="email" placeholder="m@ejemplo.com" required />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="password">Contraseña</Label>
                            <Input id="password" name="password" type="password" required />
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-2">
                        <Button className="w-full" formAction={login}>Acceder</Button>
                        {/* Ocultar registro por defecto en prod - solo HR/Admin deberían crear */}
                        {process.env.NODE_ENV === 'development' && (
                            <Button variant="outline" className="w-full" formAction={signup}>
                                Registrarse (Dev Only)
                            </Button>
                        )}
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}

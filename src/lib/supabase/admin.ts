import { createClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase con Service Role Key.
 * SOLO usar en server actions de /admin/usuarios para operaciones admin
 * como crear/desactivar cuentas auth.
 *
 * NO usar este cliente para queries normales — usar createClient() de server.ts.
 */
export function createAdminClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error(
            'Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY'
        )
    }

    return createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    })
}

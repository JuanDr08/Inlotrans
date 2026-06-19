# Fase 2 — Autenticación (Supabase GoTrue → D1 Custom Auth)

## Qué se hizo

Reemplazo completo del sistema de autenticación de Supabase GoTrue por auth custom sobre D1.

### Archivos nuevos

1. **`src/lib/auth/password.ts`** — Hashing de contraseñas con Web Crypto API (PBKDF2)
   - 100,000 iteraciones, salt de 16 bytes, SHA-256
   - Compatible con Cloudflare Workers (no usa Node crypto)
   - Formato almacenado: `iterations:salt_base64:hash_base64`

2. **`src/lib/auth/session.ts`** — Sesiones JWT con HMAC-SHA256
   - Firma/verificación con Web Crypto API (no usa jsonwebtoken ni jose)
   - Cookies httpOnly, secure, sameSite=lax, 7 días de duración
   - Cookie name: `inlotrans-session`
   - Helpers: `createSession`, `verifySession`, `setSessionCookie`, `getSessionCookie`, `deleteSessionCookie`, `getSessionFromRequest`

### Archivos reescritos

3. **`src/lib/auth.ts`** — `getUserProfile()` ahora lee JWT de cookie → valida → consulta perfiles en D1
   - `requireAdmin`, `requireAdminOrCoordinador`, `getOperationFilter` sin cambios funcionales

4. **`src/lib/supabase/middleware.ts`** — `updateSession()` ahora valida JWT propio
   - Ya no hace refresh de tokens Supabase ni consulta auth.getUser()
   - Solo valida la firma JWT y expiration
   - RBAC por roles se delega a Server Components (no se puede acceder a D1 desde middleware edge)
   - Rutas `/api/cron` y `/api/reportes` exentas (manejan su propia auth)

5. **`src/app/login/actions.ts`** — Login/signup contra tabla `auth_users` de D1
   - `login()`: busca por email → verifica ban → verifica password → crea JWT → setea cookie
   - `signup()`: verifica duplicado → hashea password → inserta → crea JWT → setea cookie
   - `signout()`: borra cookie → redirect

6. **`src/app/(dashboard)/admin/usuarios-actions.ts`** — Admin user management contra D1
   - `listarUsuarios()`: JOIN `perfiles` + `auth_users` en una sola query (antes eran 2 llamadas separadas a Supabase)
   - `crearUsuarioAuth()`: usa `db.batch()` para insertar `auth_users` + `perfiles` atómicamente
   - `editarPerfil()`: UPDATE directo en D1
   - `toggleBanUsuario()`: SET `banned_until` en `auth_users` (null = no baneado, fecha futura = baneado)

## Cambios de comportamiento

| Aspecto | Antes (Supabase) | Ahora (D1) |
|---|---|---|
| Password hashing | bcrypt (GoTrue interno) | PBKDF2 (Web Crypto) |
| Sesión | JWT Supabase con refresh automático | JWT custom HMAC-SHA256, 7 días |
| Ban/unban | `auth.admin.updateUserById({ ban_duration })` | Campo `banned_until` en `auth_users` |
| Crear usuario | `auth.admin.createUser()` + insert perfil (2 calls) | `db.batch()` atómico (1 transaction) |
| Listar usuarios | `perfiles.select(*)` + `auth.admin.listUsers()` (2 calls) | JOIN SQL (1 query) |
| Middleware | `supabase.auth.getUser()` + perfiles query | JWT verify solo (sin DB query) |

## Configuración necesaria

### Variable de entorno AUTH_SECRET

Generar un secret de al menos 32 caracteres:

```bash
# Generar un secret seguro
openssl rand -base64 32

# Para desarrollo local (.dev.vars):
AUTH_SECRET=tu-secret-generado-aqui

# Para producción:
npx wrangler secret put AUTH_SECRET
```

### Crear primer usuario admin

Después de la migración, no habrá usuarios en `auth_users`. Para crear el primer admin:

```bash
# Ejecutar en D1 (reemplazar email y hash generado):
npx wrangler d1 execute inlotrans-asistencia-db --command "
  INSERT INTO auth_users (id, email, password_hash)
  VALUES ('primer-admin-id', 'admin@tuempresa.com', 'hash-generado');
  INSERT INTO perfiles (id, rol, operacion_nombre)
  VALUES ('primer-admin-id', 'admin', NULL);
"
```

O usar el endpoint de signup en desarrollo y luego crear el perfil manualmente.

## Dependencias eliminables (futuro)

Una vez se complete la migración completa, estos paquetes se pueden desinstalar:
- `@supabase/ssr`
- `@supabase/supabase-js`

Por ahora se mantienen porque otros módulos (jornadas, reportes, novedades, etc.) aún los usan.

## Próxima fase

**Fase 3 — Queries D1**: Reescribir las queries de Supabase PostgREST a SQL puro para D1. Cubre: `jornadas.ts`, `reportes.ts`, `calculoHoras.ts`, actions de empleados, novedades, aprobaciones, operaciones, y las rutas de Excel/reportes.

# Guía completa: Deploy de Inlotrans en Cloudflare

Paso a paso desde cero. Asume que tenés el código en la branch `new_model` y nada configurado en Cloudflare.

---

## Paso 0 — Crear cuenta Cloudflare (si no la tenés)

1. Ir a https://dash.cloudflare.com/sign-up
2. Crear cuenta con email
3. El plan **Free** incluye D1, KV, Workers y Pages — suficiente para este proyecto

---

## Paso 1 — Instalar Wrangler (CLI de Cloudflare)

```bash
# Instalar globalmente (o usarlo con npx)
npm install -g wrangler

# Login — abre el navegador para autenticar
wrangler login
```

Verificar que funciona:
```bash
wrangler whoami
# Debería mostrar tu email y account ID
```

---

## Paso 2 — Instalar dependencias del proyecto

```bash
cd /Users/juandr08/Desktop/asistence-v2

# Instalar dependencias de Cloudflare
npm install @opennextjs/cloudflare

# Tipos para desarrollo (autocompletado D1, KV, etc.)
npm install -D @cloudflare/workers-types wrangler
```

Después de instalar, los `@ts-nocheck` en `src/lib/d1/client.ts`, `src/lib/d1/types.ts` y `open-next.config.ts` se pueden remover (los tipos ya estarán disponibles).

---

## Paso 3 — Crear la base de datos D1

```bash
npx wrangler d1 create inlotrans-asistencia-db
```

Va a imprimir algo como:
```
✅ Successfully created DB 'inlotrans-asistencia-db'

[[d1_databases]]
binding = "DB"
database_name = "inlotrans-asistencia-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**Copiar el `database_id`** y pegarlo en `wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "inlotrans-asistencia-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # ← PEGAR ACÁ
```

---

## Paso 4 — Crear el namespace KV

```bash
npx wrangler kv namespace create CACHE
```

Va a imprimir algo como:
```
✅ Successfully created KV namespace 'CACHE'

[[kv_namespaces]]
binding = "CACHE"
id = "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy"
```

**Copiar el `id`** y pegarlo en `wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "CACHE"
id = "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy"  # ← PEGAR ACÁ
```

---

## Paso 5 — Ejecutar las migraciones en D1

### En remoto (producción)

```bash
# Crear las tablas
npx wrangler d1 execute inlotrans-asistencia-db --file=migrations/0001_schema.sql --remote

# Insertar tarifas iniciales
npx wrangler d1 execute inlotrans-asistencia-db --file=migrations/0002_seed.sql --remote
```

### En local (para desarrollo)

```bash
npx wrangler d1 execute inlotrans-asistencia-db --file=migrations/0001_schema.sql --local
npx wrangler d1 execute inlotrans-asistencia-db --file=migrations/0002_seed.sql --local
```

Verificar que las tablas se crearon:
```bash
npx wrangler d1 execute inlotrans-asistencia-db --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name" --remote
```

Deberías ver: `alertas`, `aprobaciones_extras`, `auth_users`, `bolsa_horas`, `jornadas`, `movimientos_bolsa`, `novedades`, `operaciones`, `perfiles`, `semanas_dominicales`, `tarifas`, `turnos`, `usuarios`.

---

## Paso 6 — Configurar secretos

### Generar AUTH_SECRET

```bash
# Generar un secret seguro de 32+ caracteres
openssl rand -base64 32
```

Copiar el valor generado.

### Para desarrollo local

Crear archivo `.dev.vars` (ya está en `.gitignore`):

```bash
cp .dev.vars.example .dev.vars
```

Editar `.dev.vars`:
```
AUTH_SECRET=pegar-el-secret-generado-aqui
CRON_SECRET=un-token-cualquiera-para-el-cron
```

### Para producción

```bash
# Te va a pedir el valor — pegar el mismo AUTH_SECRET
npx wrangler secret put AUTH_SECRET

# Opcional — protege el cron endpoint
npx wrangler secret put CRON_SECRET
```

---

## Paso 7 — Crear el primer usuario admin

Hay dos formas:

### Opción A: Usar el signup en desarrollo (más fácil)

1. Levantar el dev server (ver Paso 9)
2. Ir a `/login` — en desarrollo aparece el botón "Registrarse (Dev Only)"
3. Registrar un usuario con email y password
4. Crear el perfil admin en D1:

```bash
# Primero buscar el ID del usuario que acabás de registrar:
npx wrangler d1 execute inlotrans-asistencia-db --command "SELECT id, email FROM auth_users" --local

# Crear el perfil admin con ese ID:
npx wrangler d1 execute inlotrans-asistencia-db --command "INSERT INTO perfiles (id, rol, operacion_nombre) VALUES ('EL-ID-DEL-USUARIO', 'admin', NULL)" --local
```

### Opción B: Insertar directamente en D1

Necesitás generar el hash de la contraseña. Podés hacer un script rápido:

```bash
# Crear un script temporal
cat > /tmp/hash.mjs << 'EOF'
const crypto = globalThis.crypto || (await import('crypto')).webcrypto;
const password = process.argv[2];
if (!password) { console.error('Usage: node hash.mjs <password>'); process.exit(1); }
const iterations = 100000;
const salt = crypto.getRandomValues(new Uint8Array(16));
const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
const hashBuffer = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, keyMaterial, 256);
const saltB64 = btoa(String.fromCharCode(...salt));
const hashB64 = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
console.log(`${iterations}:${saltB64}:${hashB64}`);
EOF

# Generar el hash
node /tmp/hash.mjs "tu-contraseña-segura"
```

Luego insertar en D1:
```bash
npx wrangler d1 execute inlotrans-asistencia-db --command "
  INSERT INTO auth_users (id, email, password_hash)
  VALUES ('$(uuidgen)', 'admin@tuempresa.com', 'EL-HASH-GENERADO');
" --remote

# Buscar el ID que se generó:
npx wrangler d1 execute inlotrans-asistencia-db --command "SELECT id FROM auth_users WHERE email = 'admin@tuempresa.com'" --remote

# Crear el perfil:
npx wrangler d1 execute inlotrans-asistencia-db --command "
  INSERT INTO perfiles (id, rol, operacion_nombre)
  VALUES ('EL-ID', 'admin', NULL);
" --remote
```

---

## Paso 8 — Crear al menos una operación

Para que el kiosco funcione, necesitás al menos una operación activa:

```bash
npx wrangler d1 execute inlotrans-asistencia-db --command "
  INSERT INTO operaciones (id, codigo, nombre, status, limite_horas, max_extras_dia, minutos_almuerzo)
  VALUES ('$(uuidgen)', 'OP1', 'Operación Principal', 1, 8, 2, 60);
" --local
```

O podés crearla desde el dashboard admin una vez hagas login (ruta `/admin/operaciones`).

---

## Paso 9 — Desarrollo local

```bash
# Levantar el servidor de desarrollo
npm run dev
```

> **Nota importante**: `npm run dev` usa el dev server de Next.js. Para probar con los bindings de Cloudflare (D1, KV), necesitás que OpenNext los provea. Si `getD1()` falla en `npm run dev`, probá con:

```bash
# Dev server con bindings de Cloudflare
npx wrangler pages dev .next --d1=DB --kv=CACHE
```

O buildear y previsualizar:
```bash
npx opennextjs-cloudflare build
npx wrangler pages dev .open-next/assets --d1=DB --kv=CACHE
```

---

## Paso 10 — Build y deploy a producción

### Primera vez: Crear el proyecto en Cloudflare Pages

```bash
# Build con OpenNext
npx opennextjs-cloudflare build

# Deploy (la primera vez crea el proyecto)
npx wrangler pages deploy .open-next/assets --project-name=inlotrans-asistencia
```

Cloudflare te va a dar una URL como: `https://inlotrans-asistencia.pages.dev`

### Deploys siguientes

```bash
npx opennextjs-cloudflare build && npx wrangler pages deploy .open-next/assets --project-name=inlotrans-asistencia
```

---

## Paso 11 — Dominio personalizado (opcional)

Si querés usar tu propio dominio (ej: `asistencia.tuempresa.com`):

### Si el dominio ya está en Cloudflare

1. Ir a **Cloudflare Dashboard** → **Pages** → `inlotrans-asistencia`
2. Tab **Custom domains** → **Set up a custom domain**
3. Escribir `asistencia.tuempresa.com`
4. Cloudflare crea el registro DNS automáticamente
5. Esperar ~2 minutos a que se propague

### Si el dominio está en otro proveedor

**Opción A: Transferir el DNS a Cloudflare** (recomendado)
1. Ir a **Cloudflare Dashboard** → **Add a site** → ingresar el dominio
2. Cambiar los nameservers en tu proveedor actual a los que Cloudflare te indique
3. Una vez propagado (puede tomar hasta 24h), agregar el custom domain en Pages

**Opción B: Usar un CNAME** (sin transferir)
1. En tu proveedor DNS, crear un registro CNAME:
   - Nombre: `asistencia` (o lo que prefieras)
   - Valor: `inlotrans-asistencia.pages.dev`
2. Luego en Pages → Custom domains → agregar el subdominio

---

## Paso 12 — Verificar el cron

El cron se ejecuta automáticamente todos los días a las 00:00 UTC (19:00 hora Colombia). Para probarlo manualmente:

```bash
# Local
curl http://localhost:8788/api/cron/autocierre

# Producción (si configuraste CRON_SECRET)
curl -H "Authorization: Bearer TU-CRON-SECRET" https://inlotrans-asistencia.pages.dev/api/cron/autocierre

# Producción (si NO configuraste CRON_SECRET)
curl https://inlotrans-asistencia.pages.dev/api/cron/autocierre
```

Debería devolver:
```json
{
  "success": true,
  "timestamp": "...",
  "inconsistentes_marcadas": 0,
  "ids_inconsistentes": [],
  "cierre_dominical": null
}
```

---

## Paso 13 — Checklist de verificación

Una vez desplegado, verificar cada funcionalidad:

- [ ] **Login**: Ir a `/login`, ingresar credenciales del admin
- [ ] **Dashboard**: Debería cargar `/admin`
- [ ] **Operaciones**: `/admin/operaciones` — crear/editar operaciones y turnos
- [ ] **Usuarios sistema**: `/admin/usuarios` — crear un coordinador
- [ ] **Empleados**: `/empleados` — crear un empleado de prueba
- [ ] **Kiosco**: Ir a `/` — registrar entrada con cédula del empleado + foto
- [ ] **Kiosco salida**: Registrar salida del mismo empleado
- [ ] **Novedades**: `/novedades` — crear una novedad de prueba
- [ ] **Aprobaciones**: `/aprobaciones` — verificar que aparecen extras pendientes (si la jornada duró >8h)
- [ ] **Detalle empleado**: `/empleados/CEDULA` — verificar jornadas, bolsa, novedades
- [ ] **Excel nómina**: Descargar reporte desde `/admin` → botón Nómina
- [ ] **Planos**: Descargar planos desde `/admin` → botón Planos
- [ ] **Cron**: Ejecutar manualmente y verificar respuesta

---

## Troubleshooting

### `getCloudflareContext is not a function`
El dev server de Next.js (`npm run dev`) no inyecta el contexto de Cloudflare. Usá `wrangler pages dev` en su lugar.

### `D1_ERROR: no such table: xxx`
Las migraciones no se ejecutaron. Correr:
```bash
npx wrangler d1 execute inlotrans-asistencia-db --file=migrations/0001_schema.sql --remote
```

### ExcelJS falla en Workers
Si ExcelJS no funciona con `nodejs_compat`, hay dos opciones:
1. Verificar que `wrangler.toml` tiene `compatibility_flags = ["nodejs_compat"]`
2. Si sigue fallando, habría que reemplazar ExcelJS por una librería compatible (xlsx-js-style o similar)

### `AUTH_SECRET not set`
Verificar que el secret está configurado:
```bash
# Ver secretos configurados
npx wrangler pages secret list --project-name=inlotrans-asistencia
```

### La sesión no persiste / redirect loop en login
Verificar que `AUTH_SECRET` tiene el mismo valor en `.dev.vars` (local) y en los secrets de producción.

---

## Resumen de recursos Cloudflare creados

| Recurso | Nombre | Tipo |
|---|---|---|
| D1 Database | `inlotrans-asistencia-db` | Base de datos SQLite |
| KV Namespace | `CACHE` | Key-Value store |
| Pages Project | `inlotrans-asistencia` | Hosting + Workers |
| Cron Trigger | `0 0 * * *` | Ejecución diaria |
| Secret | `AUTH_SECRET` | JWT signing key |
| Secret | `CRON_SECRET` | Bearer token del cron (opcional) |

## Costos (plan Free)

| Recurso | Límite Free | Uso estimado del proyecto |
|---|---|---|
| D1 | 5M rows read/día, 100K writes/día | ~1K reads/día, ~200 writes/día |
| KV | 100K reads/día, 1K writes/día | ~500 reads/día, ~10 writes/día |
| Workers | 100K requests/día | ~2K requests/día |
| Pages | Unlimited sites, 500 builds/mes | 1 site, ~10 builds/mes |

El proyecto entra holgadamente en el plan Free.

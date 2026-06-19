-- Inlotrans Asistencia — D1 Schema
-- Migrated from Supabase Postgres to Cloudflare D1 (SQLite)

-- ═══════════════════════════════════════════════════════════════
-- AUTH (replaces Supabase GoTrue auth.users)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE auth_users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    banned_until TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ═══════════════════════════════════════════════════════════════
-- CORE TABLES
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE usuarios (
    id TEXT PRIMARY KEY,                    -- cédula
    nombre TEXT NOT NULL,
    cargo TEXT,
    operacion TEXT,
    birthdate TEXT,
    status TEXT NOT NULL DEFAULT 'activo',  -- activo / inactivo
    turno_id TEXT,
    salario REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE perfiles (
    id TEXT PRIMARY KEY,                    -- FK → auth_users.id
    rol TEXT NOT NULL,                      -- admin / coordinador
    operacion_nombre TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (id) REFERENCES auth_users(id) ON DELETE CASCADE
);

CREATE TABLE operaciones (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE,
    codigo TEXT UNIQUE,
    limite_horas INTEGER NOT NULL DEFAULT 8,
    minutos_almuerzo INTEGER NOT NULL DEFAULT 60,
    max_extras_dia INTEGER DEFAULT 2,
    status INTEGER NOT NULL DEFAULT 1,      -- 1=activa, 0=inactiva
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE turnos (
    id TEXT PRIMARY KEY,
    operacion_id TEXT NOT NULL,
    nombre TEXT NOT NULL,
    hora_inicio TEXT NOT NULL,
    hora_fin TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (operacion_id) REFERENCES operaciones(id) ON DELETE CASCADE
);

CREATE TABLE tarifas (
    id TEXT PRIMARY KEY,
    tipo_hora TEXT NOT NULL,
    precio_por_hora REAL NOT NULL,
    codigo_nomina TEXT,
    activo INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ═══════════════════════════════════════════════════════════════
-- NOVEDADES
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE novedades (
    id TEXT PRIMARY KEY,
    usuario_id TEXT NOT NULL,
    usuario_nombre TEXT NOT NULL,
    tipo_novedad TEXT NOT NULL,
    fecha_novedad TEXT NOT NULL,             -- YYYY-MM-DD
    fecha_inicio TEXT,                       -- YYYY-MM-DD, nullable
    fecha_fin TEXT,                          -- YYYY-MM-DD, nullable
    es_pagado INTEGER NOT NULL DEFAULT 0,   -- 0=false, 1=true
    codigo_causa INTEGER,
    tipo_ausentismo INTEGER,
    valor_monetario REAL,
    descripcion TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE INDEX idx_novedades_usuario ON novedades(usuario_id);
CREATE INDEX idx_novedades_tipo ON novedades(tipo_novedad);
CREATE INDEX idx_novedades_fecha ON novedades(fecha_novedad);

-- ═══════════════════════════════════════════════════════════════
-- JORNADAS (central entity)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE jornadas (
    id TEXT PRIMARY KEY,
    empleado_id TEXT NOT NULL,
    operacion TEXT NOT NULL,
    entrada TEXT NOT NULL,                   -- ISO timestamp
    salida TEXT,                             -- ISO timestamp, nullable
    estado TEXT NOT NULL DEFAULT 'ABIERTO',  -- ABIERTO/CERRADO/CERRADO_MANUAL/INCONSISTENTE
    minutos_normales INTEGER NOT NULL DEFAULT 0,
    minutos_nocturnas INTEGER NOT NULL DEFAULT 0,
    minutos_domingos INTEGER NOT NULL DEFAULT 0,
    minutos_festivos INTEGER NOT NULL DEFAULT 0,
    minutos_domingos_festivos_nocturnos INTEGER NOT NULL DEFAULT 0,
    minutos_extras_ordinarias INTEGER NOT NULL DEFAULT 0,
    minutos_extras_nocturnas INTEGER NOT NULL DEFAULT 0,
    minutos_extras_dominical_festivo INTEGER NOT NULL DEFAULT 0,
    minutos_extras_nocturna_dominical_festivo INTEGER NOT NULL DEFAULT 0,
    minutos_total INTEGER NOT NULL DEFAULT 0,
    minutos_almuerzo_descontados INTEGER NOT NULL DEFAULT 0,
    cerrada_por TEXT,                        -- empleado/coordinador/cron
    hora_salida_manual TEXT,
    alerta_critica INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (empleado_id) REFERENCES usuarios(id)
);

-- Partial unique index: only one ABIERTO per employee
CREATE UNIQUE INDEX idx_jornadas_abierto_unico
    ON jornadas(empleado_id) WHERE estado = 'ABIERTO';

CREATE INDEX idx_jornadas_empleado ON jornadas(empleado_id);
CREATE INDEX idx_jornadas_estado ON jornadas(estado);
CREATE INDEX idx_jornadas_entrada ON jornadas(entrada);
CREATE INDEX idx_jornadas_empleado_estado ON jornadas(empleado_id, estado);

-- ═══════════════════════════════════════════════════════════════
-- APROBACIONES DE HORAS EXTRAS
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE aprobaciones_extras (
    id TEXT PRIMARY KEY,
    jornada_id TEXT NOT NULL,
    empleado_id TEXT NOT NULL,
    minutos_solicitados INTEGER NOT NULL,
    estado TEXT NOT NULL DEFAULT 'PENDIENTE',  -- PENDIENTE/APROBADA/RECHAZADA
    coordinador_id TEXT,
    nota_coordinador TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (jornada_id) REFERENCES jornadas(id),
    FOREIGN KEY (empleado_id) REFERENCES usuarios(id)
);

CREATE INDEX idx_aprobaciones_estado ON aprobaciones_extras(estado);
CREATE INDEX idx_aprobaciones_empleado ON aprobaciones_extras(empleado_id);
CREATE INDEX idx_aprobaciones_jornada ON aprobaciones_extras(jornada_id);

-- ═══════════════════════════════════════════════════════════════
-- BOLSA DE HORAS (1 row per employee)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE bolsa_horas (
    empleado_id TEXT PRIMARY KEY,
    saldo_minutos INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (empleado_id) REFERENCES usuarios(id)
);

CREATE TABLE movimientos_bolsa (
    id TEXT PRIMARY KEY,
    empleado_id TEXT NOT NULL,
    jornada_id TEXT,
    novedad_id TEXT,
    minutos INTEGER NOT NULL,
    motivo TEXT NOT NULL,                     -- ABONO_EXCEDENTE/CARGO_DEFICIT/NOVEDAD_COMPENSA/AJUSTE_MANUAL
    saldo_antes INTEGER NOT NULL,
    saldo_despues INTEGER NOT NULL,
    nota TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (empleado_id) REFERENCES usuarios(id)
);

CREATE INDEX idx_movimientos_empleado ON movimientos_bolsa(empleado_id);

-- ═══════════════════════════════════════════════════════════════
-- CUMPLIMIENTO SEMANAL (Ley 44h)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE semanas_dominicales (
    id TEXT PRIMARY KEY,
    empleado_id TEXT NOT NULL,
    semana_inicio TEXT NOT NULL,              -- YYYY-MM-DD
    semana_fin TEXT NOT NULL,                 -- YYYY-MM-DD
    minutos_ordinarios INTEGER NOT NULL DEFAULT 0,
    minutos_novedades_remuneradas INTEGER NOT NULL DEFAULT 0,
    total_minutos_cumplimiento INTEGER GENERATED ALWAYS AS (minutos_ordinarios + minutos_novedades_remuneradas) STORED,
    paga_domingo INTEGER NOT NULL DEFAULT 0, -- 0=false, 1=true
    marcado_por TEXT NOT NULL DEFAULT 'sistema',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (empleado_id) REFERENCES usuarios(id)
);

-- Composite unique for upsert ON CONFLICT
CREATE UNIQUE INDEX idx_semanas_empleado_inicio
    ON semanas_dominicales(empleado_id, semana_inicio);

-- ═══════════════════════════════════════════════════════════════
-- ALERTAS
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE alertas (
    id TEXT PRIMARY KEY,
    tipo TEXT NOT NULL,                       -- INCONSISTENTE/ALERTA_CRITICA/EXTRAS_PENDIENTES
    empleado_id TEXT NOT NULL,
    jornada_id TEXT,
    operacion TEXT,
    mensaje TEXT,
    leida INTEGER NOT NULL DEFAULT 0,        -- 0=false, 1=true
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (empleado_id) REFERENCES usuarios(id)
);

CREATE INDEX idx_alertas_empleado ON alertas(empleado_id);
CREATE INDEX idx_alertas_tipo ON alertas(tipo);
CREATE INDEX idx_alertas_leida ON alertas(leida);

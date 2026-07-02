-- Performance indexes for D1 optimization
-- Apply with: wrangler d1 execute inlotrans-asistencia-db --remote --file=migrations/0003_indexes.sql

-- P0: Admin page, nomina, extras, cron — the heaviest queries filter by estado + entrada range
CREATE INDEX IF NOT EXISTS idx_jornadas_estado_entrada
    ON jornadas(estado, entrada);

-- P1: Employee detail + per-employee period queries
CREATE INDEX IF NOT EXISTS idx_jornadas_empleado_estado_entrada
    ON jornadas(empleado_id, estado, entrada);

-- P1: Operation filter for coordinadores
CREATE INDEX IF NOT EXISTS idx_jornadas_operacion
    ON jornadas(operacion);

-- P2: FK lookup on alertas (corregirInconsistente does full scan without this)
CREATE INDEX IF NOT EXISTS idx_alertas_jornada
    ON alertas(jornada_id);

-- P2: Paid-novedad check on every SALIDA with deficit
CREATE INDEX IF NOT EXISTS idx_novedades_usuario_pagado_fecha
    ON novedades(usuario_id, es_pagado, fecha_novedad);

-- P2: Empleados page coordinador filter
CREATE INDEX IF NOT EXISTS idx_usuarios_operacion
    ON usuarios(operacion);

-- Drop single-column indexes now covered by composites above
DROP INDEX IF EXISTS idx_jornadas_estado;
DROP INDEX IF EXISTS idx_jornadas_entrada;

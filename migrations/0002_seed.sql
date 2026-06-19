-- Seed data for D1 — initial tarifas (2026 rates)
-- These match the hardcoded fallback in calculoHoras.ts

INSERT INTO tarifas (id, tipo_hora, precio_por_hora, codigo_nomina, activo) VALUES
    ('t-normal',                              'normal',                              7727, NULL,    1),
    ('t-nocturno',                            'nocturno',                            2705, '11501', 1),
    ('t-extra',                               'extra',                               9659, '11001', 1),
    ('t-extraNocturno',                       'extraNocturno',                       13522, '11002', 1),
    ('t-domingo',                             'domingo',                             5795, '11502', 1),
    ('t-festivo',                             'festivo',                             5795, '11502', 1),
    ('t-domingoFestivoNocturno',              'domingoFestivoNocturno',              8500, '11503', 1),
    ('t-extraDominicalFestivo',               'extraDominicalFestivo',               15454, '11003', 1),
    ('t-extraNocturnaDominicalFestivo',        'extraNocturnaDominicalFestivo',       19317, '11004', 1);

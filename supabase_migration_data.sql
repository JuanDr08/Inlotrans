-- INLOTRANS DB MIGRATION EXPORT
-- Generated on 2026-02-24T16:25:06.188Z


-- MIGRATION FOR TABLE: usuarios
INSERT INTO public."usuarios" ("id", "nombre", "cargo", "operacion", "created_at", "updated_at", "birthdate", "status") VALUES 
('1073234498', 'DIANA KATERIN CLAVIJO CALLEJAS', 'COORDINADOR ADMINISTRATIVO', 'Administrativo J3', '2026-02-11T19:06:20.991Z', '2026-02-11T19:06:20.991Z', NULL, 'activo'),
('109551600', 'SHARON NICOL FRANCO MARTINEZ', 'APRENDIZ HSEQ', 'Administrativo J3', '2026-02-11T19:07:50.710Z', '2026-02-11T19:07:50.710Z', NULL, 'activo'),
('1032455444', 'JESSICA ESTEFANIA BEJARANO PAEZ', 'DIRECTORA HSEQ', 'Administrativo J3', '2026-02-11T19:09:13.674Z', '2026-02-11T19:09:13.674Z', NULL, 'activo'),
('1031648357', 'LORENA ANJHUL MEDINA YAZO', 'ANALISTA IT Y MARKETING', 'Administrativo J3', '2026-02-11T19:13:35.070Z', '2026-02-11T19:13:35.070Z', NULL, 'activo'),
('1073511191', 'JESSICA DUPERLI SANCHEZ MADRIGAL', 'AUXILIAR HSEQ', 'Administrativo J3', '2026-02-11T19:05:14.662Z', '2026-02-18T03:39:24.490Z', NULL, 'activo'),
('1021513602', 'TEST2', 'DESRAROLLO', 'Multidimensionales', '2026-02-18T03:59:33.636Z', '2026-02-18T03:59:33.636Z', '2007-01-08T05:00:00.000Z', 'activo'),
('1021513601', 'TEST', 'Operario', 'Multidimensionales', '2026-02-05T20:18:44.645Z', '2026-02-19T23:07:12.628Z', '2026-02-05T05:00:00.000Z', 'activo'),
('123456', 'ANDREA RODRIGUEZ', 'AUXILIAR HSEQ', 'Pepsico 3pd', '2026-02-20T19:07:31.096Z', '2026-02-20T19:07:31.096Z', NULL, 'activo')
ON CONFLICT DO NOTHING;

-- MIGRATION FOR TABLE: tarifas
INSERT INTO public."tarifas" ("id", "tipo_hora", "precio_por_hora", "descripcion", "activo", "fecha_inicio", "fecha_fin", "created_at", "updated_at") VALUES 
(1, 'normal', '7959.00', 'Hora normal (primeras 8 horas diarias)', true, '2026-01-01T05:00:00.000Z', NULL, '2026-02-05T20:13:46.415Z', '2026-02-05T23:21:56.255Z'),
(6, 'nocturno', '10745.00', 'Hora nocturna ordinaria (19:00-06:00)', true, '2026-01-01T05:00:00.000Z', NULL, '2026-02-05T20:13:46.415Z', '2026-02-05T23:21:56.255Z'),
(2, 'extra', '9948.00', 'Hora extra ordinaria (después de 8 horas)', true, '2026-01-01T05:00:00.000Z', NULL, '2026-02-05T20:13:46.415Z', '2026-02-05T23:21:56.255Z'),
(7, 'extraNocturno', '13928.00', 'Hora extra nocturna', true, '2026-01-01T05:00:00.000Z', NULL, '2026-02-05T20:13:46.415Z', '2026-02-05T23:21:56.255Z'),
(3, 'domingo', '14326.00', 'Hora dominical', true, '2026-01-01T05:00:00.000Z', NULL, '2026-02-05T20:13:46.415Z', '2026-02-05T23:21:56.255Z'),
(4, 'festivo', '14326.00', 'Hora festivo', true, '2026-01-01T05:00:00.000Z', NULL, '2026-02-05T20:13:46.415Z', '2026-02-05T23:21:56.255Z'),
(5, 'domingoFestivoNocturno', '17111.00', 'Hora dominical/festivo nocturno (19:00-23:59)', true, '2026-01-01T05:00:00.000Z', NULL, '2026-02-05T20:13:46.415Z', '2026-02-05T23:21:56.255Z'),
(8, 'extraDominicalFestivo', '17111.00', 'Hora extra diurna dominical/festivo', true, '2026-01-01T05:00:00.000Z', NULL, '2026-02-05T23:21:56.255Z', '2026-02-05T23:21:56.255Z'),
(9, 'extraNocturnaDominicalFestivo', '21091.00', 'Hora extra nocturna dominical/festivo', true, '2026-01-01T05:00:00.000Z', NULL, '2026-02-05T23:21:56.255Z', '2026-02-05T23:21:56.255Z')
ON CONFLICT DO NOTHING;

-- MIGRATION FOR TABLE: novedades
INSERT INTO public."novedades" ("id", "usuario_id", "usuario_nombre", "tipo_novedad", "razon", "valor_monetario", "imagen_url", "fecha_registro", "created_at", "fecha_novedad", "remunerable", "start_date", "end_date", "causa") VALUES 
(8, '1021513601', 'TEST', 'incapacidad', 'ijbnjnb', NULL, NULL, '2026-02-20T00:07:30.796Z', '2026-02-20T00:07:30.796Z', '2026-02-19T05:00:00.000Z', true, '2026-02-04T05:00:00.000Z', '2026-02-07T05:00:00.000Z', 4),
(9, '1021513601', 'TEST', 'auxilio_no_prestacional', 'Porque si', '200000.00', NULL, '2026-02-20T01:12:08.889Z', '2026-02-20T01:12:08.889Z', '2026-02-10T05:00:00.000Z', NULL, NULL, NULL, NULL),
(10, '1031648357', 'LORENA ANJHUL MEDINA YAZO', 'auxilio_no_prestacional', 'ESTUVO EN EL DÍA', '1000.00', NULL, '2026-02-20T19:12:11.921Z', '2026-02-20T19:12:11.921Z', '2026-02-19T05:00:00.000Z', NULL, NULL, NULL, NULL)
ON CONFLICT DO NOTHING;

-- MIGRATION FOR TABLE: registros
INSERT INTO public."registros" ("row_number", "id", "usuario_nombre", "operacion", "tipo", "fecha_hora", "foto_url", "created_at") VALUES 
(3, '1021513601', 'Juan David', 'Multidimensionales', 'ENTRADA', '2026-01-02T03:33:00.000Z', 'https://drive.google.com/uc?id=1yHc4n9KrOaIWgV2EN53sISQI4SXlC7IU', '2026-02-05T20:18:44.829Z'),
(4, '1021513601', 'Juan David', 'Multidimensionales', 'SALIDA', '2026-01-02T07:33:00.000Z', 'https://drive.google.com/uc?id=1yHc4n9KrOaIWgV2EN53sISQI4SXlC7IU', '2026-02-05T20:19:21.296Z'),
(7, '1021513601', 'TEST', 'Red polar', 'ENTRADA', '2026-02-05T15:36:58.303Z', 'https://drive.google.com/uc?id=1yHc4n9KrOaIWgV2EN53sISQI4SXlC7IU', '2026-02-06T01:36:58.428Z'),
(5, '1021513601', 'TEST', 'Multidimensionales', 'ENTRADA', '2026-02-06T00:29:47.247Z', 'https://drive.google.com/uc?id=1yHc4n9KrOaIWgV2EN53sISQI4SXlC7IU', '2026-02-06T00:29:47.401Z'),
(6, '1021513601', 'TEST', 'Multidimensionales', 'SALIDA', '2026-02-06T00:59:03.478Z', 'https://drive.google.com/uc?id=1yHc4n9KrOaIWgV2EN53sISQI4SXlC7IU', '2026-02-06T00:59:03.608Z'),
(10, '1021513601', 'TEST', 'Red polar', 'SALIDA', '2026-02-05T23:36:58.303Z', NULL, '2026-02-09T21:54:17.276Z'),
(11, '1021513601', 'Juan David', 'Multidimensionales', 'ENTRADA', '2026-02-09T12:30:00.000Z', 'https://drive.google.com/file/d/ejemplo123/view', '2026-02-11T04:04:02.861Z'),
(12, '1021513601', 'Juan David', 'Multidimensionales', 'SALIDA', '2026-02-09T22:30:00.000Z', 'https://drive.google.com/file/d/ejemplo123/view', '2026-02-11T04:04:48.460Z'),
(13, '1021513601', 'Juan David', 'Multidimensionales', 'ENTRADA', '2026-02-10T12:30:00.000Z', 'https://drive.google.com/file/d/ejemplo123/view', '2026-02-11T04:10:17.918Z'),
(14, '1073234498', 'DIANA KATERIN CLAVIJO CALLEJAS', 'Administrativo J3', 'ENTRADA', '2026-02-11T09:11:41.725Z', '', '2026-02-11T19:11:43.055Z'),
(16, '109551600', 'SHARON NICOL FRANCO MARTINEZ', 'Administrativo J3', 'ENTRADA', '2026-02-11T09:14:15.490Z', '', '2026-02-11T19:14:15.638Z'),
(17, '1032455444', 'JESSICA ESTEFANIA BEJARANO PAEZ', 'Administrativo J3', 'ENTRADA', '2026-02-11T09:14:41.835Z', '', '2026-02-11T19:14:41.974Z'),
(18, '1073511191', 'JESSICA DUPERLI SANCHEZ MADRIGAL', 'Administrativo J3', 'ENTRADA', '2026-02-11T09:15:07.196Z', '', '2026-02-11T19:15:07.342Z'),
(19, '1021513601', 'Juan David', 'Multidimensionales', 'SALIDA', '2026-02-10T20:30:00.000Z', NULL, '2026-02-12T22:47:40.788Z'),
(20, '1073234498', 'DIANA KATERIN CLAVIJO CALLEJAS', 'Administrativo J3', 'SALIDA', '2026-02-11T17:11:41.725Z', NULL, '2026-02-12T22:47:40.788Z'),
(22, '109551600', 'SHARON NICOL FRANCO MARTINEZ', 'Administrativo J3', 'SALIDA', '2026-02-11T17:14:15.490Z', NULL, '2026-02-12T22:47:40.788Z'),
(23, '1032455444', 'JESSICA ESTEFANIA BEJARANO PAEZ', 'Administrativo J3', 'SALIDA', '2026-02-11T17:14:41.835Z', NULL, '2026-02-12T22:47:40.788Z'),
(24, '1073511191', 'JESSICA DUPERLI SANCHEZ MADRIGAL', 'Administrativo J3', 'SALIDA', '2026-02-11T17:15:07.196Z', NULL, '2026-02-12T22:47:40.788Z'),
(28, '1021513601', 'TEST', 'Multidimensionales', 'ENTRADA', '2026-02-12T18:21:23.732Z', '', '2026-02-12T23:21:23.860Z'),
(29, '1021513601', 'TEST', 'Multidimensionales', 'SALIDA', '2026-02-13T02:21:23.732Z', NULL, '2026-02-18T03:30:01.050Z'),
(37, '1021513602', 'TEST2', 'Multidimensionales', 'ENTRADA', '2026-02-17T23:00:01.045Z', '', '2026-02-18T04:00:01.195Z'),
(38, '1021513602', 'TEST2', 'Red polar', 'SALIDA', '2026-02-17T23:00:13.467Z', '', '2026-02-18T04:00:13.586Z'),
(39, '1021513602', 'TEST2', 'Multidimensionales', 'ENTRADA', '2026-02-17T23:14:31.216Z', '', '2026-02-18T04:14:31.338Z'),
(40, '1021513602', 'TEST2', 'Multidimensionales', 'SALIDA', '2026-02-17T23:14:57.711Z', '', '2026-02-18T04:14:57.828Z'),
(43, '1031648357', 'LORENA ANJHUL MEDINA YAZO', 'Administrativo B9', 'ENTRADA', '2026-02-20T08:47:10.708Z', 'https://drive.google.com/uc?id=10BFTRqbFkxgbXN6RCmFsKc9ZS_aZOVMr', '2026-02-20T18:47:11.697Z'),
(15, '1031648357', 'LORENA ANJHUL MEDINA YAZO', 'Administrativo J3', 'ENTRADA', '2026-02-11T09:13:54.537Z', 'https://drive.google.com/uc?id=10BFTRqbFkxgbXN6RCmFsKc9ZS_aZOVMr', '2026-02-11T19:13:55.106Z'),
(21, '1031648357', 'LORENA ANJHUL MEDINA YAZO', 'Administrativo J3', 'SALIDA', '2026-02-11T17:13:54.537Z', 'https://drive.google.com/uc?id=10BFTRqbFkxgbXN6RCmFsKc9ZS_aZOVMr', '2026-02-12T22:47:40.788Z'),
(41, '1031648357', 'LORENA ANJHUL MEDINA YAZO', 'Administrativo J3', 'ENTRADA', '2026-02-19T12:47:03.005Z', 'https://drive.google.com/uc?id=10BFTRqbFkxgbXN6RCmFsKc9ZS_aZOVMr', '2026-02-19T22:47:03.926Z'),
(42, '1031648357', 'LORENA ANJHUL MEDINA YAZO', 'Administrativo J3', 'SALIDA', '2026-02-19T12:48:43.867Z', 'https://drive.google.com/uc?id=10BFTRqbFkxgbXN6RCmFsKc9ZS_aZOVMr', '2026-02-19T22:48:44.295Z'),
(44, '1031648357', 'LORENA ANJHUL MEDINA YAZO', 'Administrativo B9', 'SALIDA', '2026-02-20T08:47:44.019Z', 'https://drive.google.com/uc?id=10BFTRqbFkxgbXN6RCmFsKc9ZS_aZOVMr', '2026-02-20T18:47:44.432Z')
ON CONFLICT DO NOTHING;

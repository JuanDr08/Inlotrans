import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config({ path: path.join(process.cwd(), '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY / ANON_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Railway connection
const railwayDbConfig = {
    host: process.env.DB_HOST || 'trolley.proxy.rlwy.net',
    port: parseInt(process.env.DB_PORT || '44354'),
    database: process.env.DB_NAME || 'railway',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'blUOheEXEQepgLmMOvqJdIeQChBorHad',
    ssl: false
};

async function migrarDatos() {
    const pgClient = new Client(railwayDbConfig);

    try {
        console.log('🔌 Conectando a Railway...');
        await pgClient.connect();
        console.log('✅ Conectado a Railway');

        console.log('\n--- MIGRANDO USUARIOS ---');
        const { rows: usuarios } = await pgClient.query('SELECT * FROM usuarios');
        console.log(`Encontrados ${usuarios.length} usuarios en Railway.`);

        for (const user of usuarios) {
            const { error } = await supabase.from('usuarios').upsert({
                id: user.id,
                nombre: user.nombre,
                cargo: user.cargo,
                operacion: user.operacion,
                birthdate: user.birthdate,
                status: user.status || 'activo',
                created_at: user.created_at,
                updated_at: user.updated_at
            });
            if (error) console.error(`Error migrando usuario ${user.id}:`, error.message);
        }
        console.log('✅ Usuarios migrados');

        console.log('\n--- MIGRANDO REGISTROS ---');
        const { rows: registros } = await pgClient.query('SELECT * FROM registros');
        console.log(`Encontrados ${registros.length} registros en Railway.`);

        let regsMigrados = 0;
        for (const reg of registros) {
            const { error } = await supabase.from('registros').upsert({
                row_number: reg.row_number,
                id: reg.id,
                usuario_nombre: reg.usuario_nombre,
                operacion: reg.operacion,
                tipo: reg.tipo,
                fecha_hora: reg.fecha_hora,
                foto_url: reg.foto_url,
                created_at: reg.created_at
            });
            if (error) {
                console.error(`Error migrando registro ${reg.row_number}:`, error.message);
            } else {
                regsMigrados++;
            }
        }
        console.log(`✅ ${regsMigrados}/${registros.length} Registros migrados`);

        console.log('\n--- MIGRANDO NOVEDADES ---');
        // V1 novedades table mapping to V2 novedades table
        // We know V1 has fecha_inicio, fecha_fin, es_remunerado, causa_codigo, etc
        const { rows: novedades } = await pgClient.query('SELECT * FROM novedades');
        console.log(`Encontradas ${novedades.length} novedades en Railway.`);

        let novsMigradas = 0;
        for (const nov of novedades) {
            const { error } = await supabase.from('novedades').upsert({
                id: nov.id,
                usuario_id: nov.usuario_id,
                usuario_nombre: nov.usuario_nombre || '', // In V2 it's required, we can grab from users or assume V1 had it
                tipo_novedad: nov.tipo_novedad,
                razon: nov.razon || nov.notas || '',
                valor_monetario: nov.valor_monetario,
                imagen_url: nov.imagen_url,
                fecha_novedad: nov.fecha_inicio || nov.fecha_registro,
                start_date: nov.fecha_inicio,
                end_date: nov.fecha_fin,
                remunerable: nov.es_remunerado,
                causa: nov.causa_codigo ? parseInt(nov.causa_codigo) : null,
                created_at: nov.fecha_registro || nov.created_at || new Date().toISOString()
            });
            if (error) {
                console.error(`Error migrando novedad ${nov.id}:`, error.message);
            } else {
                novsMigradas++;
            }
        }
        console.log(`✅ ${novsMigradas}/${novedades.length} Novedades migradas`);

        console.log('\n🎉 MIGRACIÓN COMPLETADA CON ÉXITO 🎉');
    } catch (e) {
        console.error('❌ Error durante la migración:', e);
    } finally {
        await pgClient.end();
    }
}

migrarDatos();

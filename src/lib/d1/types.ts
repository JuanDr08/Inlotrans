/**
 * Cloudflare Worker environment bindings.
 * Must match wrangler.toml bindings.
 *
 * NOTE: Requires @cloudflare/workers-types for D1Database and KVNamespace types.
 * Install: npm install -D @cloudflare/workers-types
 * Then add to tsconfig.json compilerOptions.types: ["@cloudflare/workers-types"]
 */

// @ts-nocheck — Cloudflare types not available until dependencies are installed
interface CloudflareEnv {
    DB: D1Database
    CACHE: KVNamespace
    AUTH_SECRET: string
    CRON_SECRET?: string
    APP_ENV: string
}

declare global {
    interface CloudflareEnv {
        DB: D1Database
        CACHE: KVNamespace
        AUTH_SECRET: string
        CRON_SECRET?: string
        APP_ENV: string
    }
}

export type { CloudflareEnv }

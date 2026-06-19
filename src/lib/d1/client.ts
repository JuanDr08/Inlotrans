/**
 * D1 Database client utilities.
 *
 * In Cloudflare Workers, the D1 binding is available via the `env` object
 * passed to the Worker's fetch handler. With @opennextjs/cloudflare, this
 * is accessible through `getCloudflareContext()`.
 *
 * Usage:
 *   const db = getD1()
 *   const users = await db.prepare('SELECT * FROM usuarios WHERE id = ?').bind(cedula).first()
 *
 * NOTE: This file requires @opennextjs/cloudflare and @cloudflare/workers-types.
 * Install them before using: npm install @opennextjs/cloudflare && npm install -D @cloudflare/workers-types
 */

// @ts-nocheck — Cloudflare types not available until dependencies are installed
import { getCloudflareContext } from '@opennextjs/cloudflare'

export function getD1() {
    const { env } = getCloudflareContext()
    return env.DB
}

export function getKV() {
    const { env } = getCloudflareContext()
    return env.CACHE
}

export function getEnv() {
    const { env } = getCloudflareContext()
    return env
}

export function generateId(): string {
    return crypto.randomUUID()
}

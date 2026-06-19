/**
 * Password hashing using Web Crypto API (PBKDF2).
 * Compatible with Cloudflare Workers — no Node.js crypto needed.
 */

const ITERATIONS = 100_000
const SALT_LENGTH = 16
const KEY_LENGTH = 32
const ALGORITHM = 'PBKDF2'
const HASH_ALGO = 'SHA-256'

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)))
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
    }
    return bytes.buffer
}

export async function hashPassword(password: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
    const encoder = new TextEncoder()

    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        ALGORITHM,
        false,
        ['deriveBits'],
    )

    const derivedBits = await crypto.subtle.deriveBits(
        {
            name: ALGORITHM,
            salt,
            iterations: ITERATIONS,
            hash: HASH_ALGO,
        },
        keyMaterial,
        KEY_LENGTH * 8,
    )

    const saltB64 = arrayBufferToBase64(salt.buffer)
    const hashB64 = arrayBufferToBase64(derivedBits)

    return `${ITERATIONS}:${saltB64}:${hashB64}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
    const [iterStr, saltB64, hashB64] = stored.split(':')
    const iterations = parseInt(iterStr, 10)
    const salt = new Uint8Array(base64ToArrayBuffer(saltB64))

    const encoder = new TextEncoder()
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        ALGORITHM,
        false,
        ['deriveBits'],
    )

    const derivedBits = await crypto.subtle.deriveBits(
        {
            name: ALGORITHM,
            salt,
            iterations,
            hash: HASH_ALGO,
        },
        keyMaterial,
        KEY_LENGTH * 8,
    )

    const newHash = arrayBufferToBase64(derivedBits)
    return newHash === hashB64
}

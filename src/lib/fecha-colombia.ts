const TZ = 'America/Bogota'

export function horaColombia(iso: string): string {
    const d = new Date(iso)
    return d.toLocaleTimeString('es-CO', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: TZ,
    })
}

export function fechaCortaColombia(iso: string): string {
    const d = new Date(iso)
    return d.toLocaleDateString('es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: TZ,
    })
}

export function fechaLargaColombia(iso: string): string {
    const d = new Date(iso)
    return d.toLocaleDateString('es-CO', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        timeZone: TZ,
    })
}

export function fechaHoraColombia(iso: string): string {
    const d = new Date(iso)
    return d.toLocaleString('es-CO', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: TZ,
    })
}

export function nombreMesColombia(iso: string): string {
    const d = new Date(iso)
    const s = d.toLocaleDateString('es-CO', {
        month: 'long',
        year: 'numeric',
        timeZone: TZ,
    })
    return s.charAt(0).toUpperCase() + s.slice(1)
}

export function fechaSoloFecha(iso: string): string {
    const [y, m, d] = iso.split('T')[0].split('-').map(Number)
    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
}

export function formatDateColombia(date: Date): string {
    return date.toLocaleDateString('es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: TZ,
    })
}

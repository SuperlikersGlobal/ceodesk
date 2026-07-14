// Utilidades de formato de fecha/tiempo en español, sin dependencias externas.

const DAY = 86400000

export function formatDate(iso?: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateTime(iso?: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// "hace 2 h", "hace 3 d", "en 2 d" — relativo a ahora.
export function relativeTime(iso?: string): string {
  if (!iso) return ''
  const diff = new Date(iso).getTime() - Date.now()
  const abs = Math.abs(diff)
  const future = diff > 0
  let value: number
  let unit: string
  if (abs < 3600000) {
    value = Math.max(1, Math.round(abs / 60000))
    unit = 'min'
  } else if (abs < DAY) {
    value = Math.round(abs / 3600000)
    unit = 'h'
  } else {
    value = Math.round(abs / DAY)
    unit = 'd'
  }
  return future ? `en ${value} ${unit}` : `hace ${value} ${unit}`
}

export interface DueInfo {
  label: string
  tone: 'ok' | 'soon' | 'overdue' | 'none'
}

export function dueInfo(iso?: string): DueInfo {
  if (!iso) return { label: 'Sin fecha límite', tone: 'none' }
  const diff = new Date(iso).getTime() - Date.now()
  if (diff < 0) return { label: `Vencida ${relativeTime(iso)}`, tone: 'overdue' }
  if (diff < 2 * DAY) return { label: `Vence ${relativeTime(iso)}`, tone: 'soon' }
  return { label: `Vence ${relativeTime(iso)}`, tone: 'ok' }
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('')
}

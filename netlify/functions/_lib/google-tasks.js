// Integración con Google Tasks como HUB compartido con LADCC Tasks.
// Contrato: docs/INTEGRATION_GOOGLE_TASKS.md (repo luchodelcast/ladcc-tasks).
//
// Reglas de oro (no romper sin actualizar el contrato):
//   - CeoDesk NUNCA escribe en el Sheet ni en el Apps Script; solo la API Tasks.
//   - Solo puede haber UNA línea de control al final de `notes` (huella o meta),
//     porque ambas se detectan con un regex anclado al final (`$`).
//   - CeoDesk NUNCA inventa la huella `· LADCC-XXXX`; la LEE y la PRESERVA.
//   - CeoDesk escribe (al crear) el marcador `· meta cat= imp= urg=` como última línea.
//   - Se mapea por Google-Task-ID (no por título) para no duplicar (§9).
import { googleSAEnabled, accessTokenFor } from './google-auth.js'

const SCOPE = 'https://www.googleapis.com/auth/tasks'
const API = 'https://tasks.googleapis.com/tasks/v1'

// Las 6 listas del sistema personal de Luis (decisión §3 del contrato).
export const HUB_LISTS = ['Superlikers', 'LADCC', 'DCDG', 'LIH', 'La Isabella', 'DCC']
export const DEFAULT_LIST = 'Superlikers'

export function googleTasksEnabled() { return googleSAEnabled() }

// A quién impersonar: la cuenta dueña del hub (Luis). Configurable; cae al 1er CEO.
export function hubSubject() {
  return (
    (process.env.GOOGLE_TASKS_IMPERSONATE || '').trim() ||
    String(process.env.CEO_EMAILS || 'luis@iwin.im').split(',')[0].trim() ||
    null
  )
}

// ─── Helpers puros del contrato (§4) — testeables sin red ────────────────────

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

// Huella que escribe el sync de LADCC (CAPA 1 anti-duplicación).
export const FINGERPRINT_RE = /\n?·\s*(LADCC-\d+)\s*$/
// Marcador que escribe CeoDesk al crear (lo consume LADCC en la siguiente importación).
export const META_RE = /\n?·\s*meta\s+([^\n]+)\s*$/

// Descripción visible: sin la línea de control final (huella o meta) (§4.4).
export function cleanNotes(notes) {
  return String(notes || '')
    .replace(META_RE, '')
    .replace(FINGERPRINT_RE, '')
    .replace(/\s+$/, '')
}

// Lee la huella `· LADCC-XXXX` si existe (para preservarla y para mapear).
export function fingerprintOf(notes) {
  const m = String(notes || '').match(FINGERPRINT_RE)
  return m ? m[1] : null
}

// Parsea el marcador `· meta cat= imp= urg=` a un objeto { cat, imp, urg }.
// Los `_` vuelven a espacios (convención del contrato §4.2).
export function metaOf(notes) {
  const m = String(notes || '').match(META_RE)
  if (!m) return null
  const out = {}
  for (const pair of m[1].trim().split(/\s+/)) {
    const eq = pair.indexOf('=')
    if (eq <= 0) continue
    const k = pair.slice(0, eq)
    const v = pair.slice(eq + 1).replace(/_/g, ' ')
    if (['cat', 'imp', 'urg'].includes(k)) out[k] = v
  }
  return Object.keys(out).length ? out : null
}

// Construye la línea `· meta` (valores con espacios → `_`). '' si no hay claves.
export function buildMetaLine({ cat, imp, urg } = {}) {
  const parts = []
  const put = (k, v) => { if (v && String(v).trim()) parts.push(k + '=' + String(v).trim().replace(/\s+/g, '_')) }
  put('cat', cat); put('imp', imp); put('urg', urg)
  return parts.length ? '· meta ' + parts.join(' ') : ''
}

// Componer `notes` para una tarea NUEVA: descripción + (opcional) línea `· meta`.
export function composeCreateNotes(description, meta) {
  const line = buildMetaLine(meta || {})
  return [String(description || '').trim(), line].filter(Boolean).join('\n')
}

// Componer `notes` al EDITAR: descripción + (si existía) la huella preservada (§6.3).
export function composeEditNotes(description, prevNotes) {
  const fp = fingerprintOf(prevNotes)
  const base = String(description || '').trim()
  if (!fp) return base
  return (base ? base + '\n' : '') + '· ' + fp
}

// ─── Acceso a la API de Google Tasks ─────────────────────────────────────────

async function token() {
  const subject = hubSubject()
  if (!subject) return null
  return accessTokenFor(subject, [SCOPE])
}

async function apiFetch(accessToken, path, opts = {}) {
  const r = await fetch(API + path, {
    method: opts.method || 'GET',
    headers: { Authorization: `Bearer ${accessToken}`, ...(opts.body ? { 'content-type': 'application/json' } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  if (!r.ok) {
    const t = await r.text().catch(() => '')
    throw new Error(`Google Tasks ${r.status}: ${t.slice(0, 200)}`)
  }
  return r.json()
}

async function fetchLists(accessToken) {
  const j = await apiFetch(accessToken, '/users/@me/lists?maxResults=100')
  return j.items || []
}

// Resuelve las 6 listas del hub (id + título) presentes en la cuenta.
async function hubListsOf(accessToken) {
  const wanted = new Set(HUB_LISTS.map(norm))
  return (await fetchLists(accessToken)).filter((l) => wanted.has(norm(l.title)))
}

function pickList(lists, listName) {
  const byName = (name) => lists.find((l) => norm(l.title) === norm(name))
  return byName(listName) || byName(DEFAULT_LIST) || lists[0] || null
}

// Proyecta una tarea de la API al shape que consume CeoDesk.
function project(t, list) {
  return {
    gid: t.id,
    listId: list.id,
    listName: list.title,
    title: t.title || '',
    description: cleanNotes(t.notes),
    fingerprint: fingerprintOf(t.notes),
    meta: metaOf(t.notes),
    due: t.due ? t.due.slice(0, 10) : null,
    gstatus: t.status, // needsAction | completed
    completed: t.completed || null,
    updated: t.updated || null,
  }
}

// Lista las tareas de las 6 listas del hub (per-user: la cuenta de Luis).
export async function listHubTasks({ showCompleted = false } = {}) {
  if (!googleSAEnabled()) return { ok: false, reason: 'not_configured', tasks: [] }
  const accessToken = await token()
  if (!accessToken) return { ok: false, reason: 'no_subject', tasks: [] }
  const lists = await hubListsOf(accessToken)
  const params = new URLSearchParams({ showCompleted: String(showCompleted), showHidden: 'true', maxResults: '100' })
  const out = []
  for (const l of lists) {
    let j
    try { j = await apiFetch(accessToken, `/lists/${encodeURIComponent(l.id)}/tasks?${params}`) } catch { continue }
    for (const t of (j.items || [])) {
      if (!t.title) continue
      if (!showCompleted && t.status === 'completed') continue
      out.push(project(t, l))
    }
  }
  return { ok: true, tasks: out }
}

// Crea una tarea en la lista mapeada por categoría (para evitar un "move" del sync §6.1).
export async function createHubTask({ title, description = '', meta = null, due = null, listName = null }) {
  if (!googleSAEnabled()) return { ok: false, reason: 'not_configured' }
  const accessToken = await token()
  if (!accessToken) return { ok: false, reason: 'no_subject' }
  const lists = await hubListsOf(accessToken)
  const target = pickList(lists, listName || (meta && catToList(meta.cat)) || DEFAULT_LIST)
  if (!target) return { ok: false, reason: 'no_lists' }

  const notes = composeCreateNotes(description, meta)
  const body = { title: String(title || '').trim() }
  if (notes) body.notes = notes
  if (due) body.due = new Date(due + 'T00:00:00.000Z').toISOString() // RFC3339; solo fecha

  const j = await apiFetch(accessToken, `/lists/${encodeURIComponent(target.id)}/tasks`, { method: 'POST', body })
  return { ok: true, task: project(j, target) }
}

// Completar (§6.3): status completed + fecha. El sync lo marca "Hecha" en el Sheet.
export async function completeHubTask({ gid, listId, completedAt = new Date().toISOString() }) {
  if (!googleSAEnabled()) return { ok: false, reason: 'not_configured' }
  const accessToken = await token()
  if (!accessToken) return { ok: false, reason: 'no_subject' }
  const j = await apiFetch(accessToken, `/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(gid)}`, {
    method: 'PATCH', body: { status: 'completed', completed: completedAt },
  })
  return { ok: true, task: project(j, { id: listId, title: null }) }
}

// Editar título/descripción/fecha PRESERVANDO la huella `· LADCC-XXXX` (§6.3).
export async function patchHubTask({ gid, listId, title, description, due }) {
  if (!googleSAEnabled()) return { ok: false, reason: 'not_configured' }
  const accessToken = await token()
  if (!accessToken) return { ok: false, reason: 'no_subject' }
  const cur = await apiFetch(accessToken, `/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(gid)}`)
  const body = {}
  if (title != null) body.title = String(title).trim()
  if (description != null) body.notes = composeEditNotes(description, cur.notes)
  if (due !== undefined) body.due = due ? new Date(due + 'T00:00:00.000Z').toISOString() : null
  const j = await apiFetch(accessToken, `/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(gid)}`, { method: 'PATCH', body })
  return { ok: true, task: project(j, { id: listId, title: cur.listName || null }) }
}

// Mapa categoría→lista (dueño: LADCC §7). Réplica mínima para evitar un "move".
// Si no reconoce la categoría, cae a la lista por defecto (Superlikers).
function catToList(cat) {
  if (!cat) return DEFAULT_LIST
  const c = norm(cat)
  const found = HUB_LISTS.find((l) => norm(l) === c)
  return found || DEFAULT_LIST
}

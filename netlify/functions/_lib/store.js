// Acceso a Netlify Blobs: almacenamiento multiusuario incluido en Netlify
// (sin base de datos externa). Mismo enfoque que sl-crm-live.
//
// Si Blobs no está disponible (p. ej. tests fuera del runtime de Netlify),
// cae a un almacén en memoria con la misma interfaz, para poder probar la
// lógica de negocio de forma aislada. En Netlify (prod y `netlify dev`) SIEMPRE
// se usa Blobs real.
import { getStore } from '@netlify/blobs'

const mem = new Map() // storeName -> Map(key -> value)

function memStore(name) {
  if (!mem.has(name)) mem.set(name, new Map())
  const m = mem.get(name)
  return {
    async get(key, opts) {
      if (!m.has(key)) return null
      const v = m.get(key)
      return opts && opts.type === 'json' ? structuredClone(v) : v
    },
    async setJSON(key, val) { m.set(key, structuredClone(val)) },
    async set(key, val) { m.set(key, val) },
    async delete(key) { m.delete(key) },
    async list() { return { blobs: [...m.keys()].map((key) => ({ key })) } },
  }
}

function store(name) {
  // Fuerza el almacén en memoria en pruebas aisladas (fuera del runtime Netlify).
  if (process.env.CEODESK_MEMORY_STORE === '1') return memStore(name)
  try {
    return getStore(name)
  } catch {
    return memStore(name)
  }
}

export const requestsStore = () => store('ceodesk-requests') // key = id -> solicitud (con eventos)
export const usersStore = () => store('ceodesk-users')       // key = email -> usuario
export const metaStore = () => store('ceodesk-meta')          // contador de códigos, etc.
// Proyección de Google Tasks: overlay de CeoDesk mapeado por Google-Task-ID.
// Guarda solo lo que Google Tasks no representa (estado En curso/Bloqueada, área).
export const gtasksStore = () => store('ceodesk-gtasks')      // key = gid -> { status, area, updatedAt }

// Lee el overlay de una tarea de Google (o null).
export async function getGtaskOverlay(gid) {
  return gtasksStore().get(gid, { type: 'json' })
}

// Guarda/actualiza el overlay de una tarea de Google, mapeado por su gid.
export async function saveGtaskOverlay(gid, patch) {
  const s = gtasksStore()
  const prev = (await s.get(gid, { type: 'json' })) || { gid }
  const next = { ...prev, ...patch, gid, updatedAt: new Date().toISOString() }
  await s.setJSON(gid, next)
  return next
}

// Todos los overlays (para fusionarlos con la lista de Google Tasks).
export async function listGtaskOverlays() {
  const s = gtasksStore()
  const { blobs } = await s.list()
  const rows = await Promise.all(blobs.map((b) => s.get(b.key, { type: 'json' })))
  const map = {}
  for (const r of rows) if (r && r.gid) map[r.gid] = r
  return map
}

// Contador incremental para los códigos legibles (CD-101, CD-102, …).
export async function nextCode() {
  const s = metaStore()
  const meta = (await s.get('counter', { type: 'json' })) || { last: 100 }
  meta.last = (Number(meta.last) || 100) + 1
  await s.setJSON('counter', meta)
  return 'CD-' + meta.last
}

// Lista todas las solicitudes (la operación es barata para el volumen esperado).
export async function listRequests() {
  const s = requestsStore()
  const { blobs } = await s.list()
  const rows = await Promise.all(blobs.map((b) => s.get(b.key, { type: 'json' })))
  return rows.filter(Boolean).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
}

export async function getRequest(id) {
  return requestsStore().get(id, { type: 'json' })
}

export async function saveRequest(req) {
  await requestsStore().setJSON(req.id, req)
  return req
}

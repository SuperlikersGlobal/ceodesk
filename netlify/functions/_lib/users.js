// Usuarios sobre Netlify Blobs. Alta automática al entrar con Google.
// El rol se deriva del correo: CEO_EMAILS => 'ceo', el resto => 'leader'.
import { usersStore } from './store.js'

export function ceoEmails() {
  return String(process.env.CEO_EMAILS || 'luis@iwin.im')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
}

export function roleFor(email) {
  return ceoEmails().includes(String(email).toLowerCase()) ? 'ceo' : 'leader'
}

export function isCeo(user) {
  return !!user && (user.role === 'ceo' || ceoEmails().includes(String(user.u || user.email).toLowerCase()))
}

// Delegaciones de visibilidad: qué solicitudes de OTROS puede ver un usuario.
// VIEWER_DELEGATIONS = JSON { "correo_del_delegado": ["correo1","correo2", ...] }
// Ej: {"angela@iwin.im":["magali@iwin.im","santiago@iwin.im"]}
export function viewerDelegations() {
  try { return JSON.parse(process.env.VIEWER_DELEGATIONS || '{}') } catch { return {} }
}

export function delegatedRequestersFor(email) {
  const map = viewerDelegations()
  const key = Object.keys(map).find((k) => k.toLowerCase() === String(email || '').toLowerCase())
  const list = key ? map[key] : []
  return (Array.isArray(list) ? list : []).map((e) => String(e).toLowerCase())
}

// ¿Puede este usuario VER esta solicitud?
//   - CEO: todo.
//   - Solicitante: la suya.
//   - Delegado: las de las personas que tiene asignadas.
export function canViewRequest(user, request) {
  if (isCeo(user)) return true
  const me = String((user && (user.u || user.email)) || '').toLowerCase()
  if (!me) return false
  const owner = String((request && request.requesterId) || '').toLowerCase()
  if (owner === me) return true
  return delegatedRequestersFor(me).includes(owner)
}

// ¿El usuario puede supervisar (ver solicitudes de otros)? CEO o delegado.
export function canSupervise(user) {
  if (isCeo(user)) return true
  const me = String((user && (user.u || user.email)) || '').toLowerCase()
  return delegatedRequestersFor(me).length > 0
}

function titleFor(email, fallbackRole) {
  let map = {}
  try { map = JSON.parse(process.env.USER_TITLES || '{}') } catch { map = {} }
  const key = Object.keys(map).find((k) => k.toLowerCase() === String(email).toLowerCase())
  if (key) return map[key]
  return fallbackRole === 'ceo' ? 'CEO' : 'Líder'
}

// Registra (o actualiza) al usuario al entrar con Google. Devuelve el perfil.
export async function getOrCreateUserByEmail(email, name) {
  email = (email || '').trim().toLowerCase()
  const s = usersStore()
  let rec = await s.get(email, { type: 'json' })
  const role = roleFor(email)
  if (!rec) {
    rec = { email, name: name || email, role, title: titleFor(email, role), createdAt: new Date().toISOString() }
  } else {
    if (name) rec.name = name
    rec.role = role
    if (!rec.title) rec.title = titleFor(email, role)
  }
  rec.lastLogin = new Date().toISOString()
  await s.setJSON(email, rec)
  return { email: rec.email, name: rec.name, role: rec.role, title: rec.title }
}

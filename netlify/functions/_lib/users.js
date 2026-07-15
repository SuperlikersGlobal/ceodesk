// Usuarios sobre Netlify Blobs. Alta automática al entrar con Google.
// El rol se deriva del correo: CEO_EMAILS => 'ceo', el resto => 'leader'.
import { usersStore } from './store.js'
import { isAncestor, hasReports } from './org.js'

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

// Chief of Staff: ve todo lo asignado al CEO. Configurable con CHIEF_OF_STAFF.
export function chiefOfStaffEmails() {
  return String(process.env.CHIEF_OF_STAFF || '')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
}
export function isChiefOfStaff(email) {
  return chiefOfStaffEmails().includes(String(email || '').toLowerCase())
}

// Destinatario por defecto (compatibilidad con solicitudes antiguas sin destinatario).
export function defaultAssignee() {
  return ceoEmails()[0] || 'luis@iwin.im'
}
export function assigneeOf(request) {
  return String((request && request.assigneeId) || defaultAssignee()).toLowerCase()
}
export function emailOf(user) {
  return String((user && (user.u || user.email)) || '').toLowerCase()
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
//   - Solicitante o destinatario: siempre.
//   - CEO: todo.
//   - Líder: lo que crea O lo que se le asigna a alguien de su equipo (subárbol).
//   - Chief of Staff: además, todo lo asignado al CEO.
//   - Delegaciones manuales (VIEWER_DELEGATIONS) por solicitante.
export function canViewRequest(user, request) {
  const me = emailOf(user)
  if (!me) return false
  const requester = String((request && request.requesterId) || '').toLowerCase()
  const assignee = assigneeOf(request)
  if (me === requester || me === assignee) return true
  if (isCeo(user)) return true
  if (isChiefOfStaff(me) && ceoEmails().includes(assignee)) return true
  if (isAncestor(me, requester) || isAncestor(me, assignee)) return true
  if (delegatedRequestersFor(me).includes(requester)) return true
  return false
}

// ¿El usuario puede supervisar (ver solicitudes de su equipo)?
export function canSupervise(user) {
  const me = emailOf(user)
  if (!me) return false
  if (isCeo(user) || isChiefOfStaff(me) || hasReports(me)) return true
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

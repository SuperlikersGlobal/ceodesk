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

// Equipo financiero: ve y gestiona Cumplimiento Fiscal. Configurable con FINANCE_TEAM.
// El CEO siempre tiene acceso, esté o no en la lista.
export function financeTeamEmails() {
  return String(process.env.FINANCE_TEAM || 'ma.isabel@iwin.im,angela@iwin.im')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
}
export function canViewFiscal(user) {
  if (!user) return false
  const email = String(user.u || user.email || '').toLowerCase()
  return isCeo(user) || financeTeamEmails().includes(email)
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

// Informadores adicionales de una solicitud (se enteran de la actividad, solo lectura).
export function watchersOf(request) {
  const w = request && request.watchers
  return (Array.isArray(w) ? w : []).map((e) => String(e || '').toLowerCase()).filter(Boolean)
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

// Asistentes personales: pueden VER y ACTUAR sobre lo asignado a su principal
// (p. ej. la asistente del CEO ayuda a evacuar lo que le asignan al CEO).
// ASSISTANTS = JSON { "principal": ["asistente1", ...] }.
// Ej: {"luis@iwin.im":["sarah@iwin.im"]}
export function assistantsMap() {
  try { return JSON.parse(process.env.ASSISTANTS || '{}') } catch { return {} }
}
// Asistentes de un principal (correos que actúan en su nombre).
export function assistantsOf(principal) {
  const map = assistantsMap()
  const key = Object.keys(map).find((k) => k.toLowerCase() === String(principal || '').toLowerCase())
  const list = key ? map[key] : []
  return (Array.isArray(list) ? list : []).map((e) => String(e).toLowerCase())
}
// Principales a los que asiste este usuario (para quién puede actuar).
export function principalsFor(assistant) {
  const me = String(assistant || '').toLowerCase()
  const map = assistantsMap()
  return Object.keys(map).filter((p) => assistantsOf(p).includes(me)).map((p) => p.toLowerCase())
}
// ¿Puede este usuario actuar como el DESTINATARIO de esta solicitud?
// (es el destinatario, o es asistente del destinatario)
export function actsAsAssignee(user, request) {
  const me = emailOf(user)
  const assignee = assigneeOf(request)
  return me === assignee || principalsFor(me).includes(assignee)
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
  if (watchersOf(request).includes(me)) return true // informador adicional
  if (isCeo(user)) return true
  if (isChiefOfStaff(me) && ceoEmails().includes(assignee)) return true
  if (principalsFor(me).includes(assignee)) return true // asistente del destinatario
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

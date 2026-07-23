// POST /api/request-action  { id, action, note }
// Aplica una decisión o interacción sobre una solicitud, con control de acceso:
//   - Destinatario: approve | reject | sign | request_info
//   - Solicitante: provide_info | cancel
//   - Destinatario o solicitante: comment
import { authUser, json } from './_lib/auth.js'
import { getRequest, saveRequest } from './_lib/store.js'
import { applyAction, isOpen, isValidAction, isActionAllowedForType, ASSIGNEE_ACTIONS, REQUESTER_ACTIONS } from './_lib/lifecycle.js'
import { canViewRequest, assigneeOf, emailOf, principalsFor } from './_lib/users.js'
import { nameFor } from './_lib/org.js'
import { notifyActivity } from './_lib/notify.js'

// Menciones (@): correos válidos (conocidos), sin duplicados, sin el actor. Acotado.
function cleanMentions(v, exclude) {
  if (!Array.isArray(v)) return []
  const ex = new Set((exclude || []).map((e) => String(e || '').toLowerCase()))
  const seen = new Set(); const out = []
  for (const x of v) {
    const e = String(x || '').trim().toLowerCase()
    if (!e || ex.has(e) || seen.has(e) || !nameFor(e)) continue
    seen.add(e); out.push(e)
    if (out.length >= 10) break
  }
  return out
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)
  const u = authUser(req)
  if (!u) return json({ error: 'No autorizado' }, 401)

  let body
  try { body = await req.json() } catch { return json({ error: 'JSON inválido' }, 400) }
  const { id, action, note } = body || {}
  if (!id || !isValidAction(action)) return json({ error: 'Solicitud o acción no válida' }, 400)

  const request = await getRequest(id)
  // 404 si no existe o el usuario no puede siquiera verla (no filtra existencia).
  if (!request || !canViewRequest(u, request)) return json({ error: 'Solicitud no encontrada' }, 404)

  if (!isActionAllowedForType(action, request.type)) {
    return json({ error: 'Esa acción no aplica a este tipo de ítem' }, 400)
  }

  const me = emailOf(u)
  // El destinatario, o su asistente personal, pueden actuar como destinatario.
  const isAssignee = assigneeOf(request) === me || principalsFor(me).includes(assigneeOf(request))
  const isRequester = String(request.requesterId).toLowerCase() === me

  // Control de acceso por tipo de acción
  if (ASSIGNEE_ACTIONS.includes(action) && !isAssignee) {
    return json({ error: 'Solo el destinatario puede tomar esta decisión' }, 403)
  }
  if (REQUESTER_ACTIONS.includes(action) && !isRequester) {
    return json({ error: 'Solo quien creó la solicitud puede hacer esto' }, 403)
  }
  if (action === 'comment' && !isAssignee && !isRequester) {
    return json({ error: 'No puedes comentar esta solicitud' }, 403)
  }

  // No re-decidir un ítem ya cerrado (salvo comentar o reabrir).
  if (!isOpen(request.status) && action !== 'comment' && action !== 'reopen') {
    return json({ error: 'Este ítem ya está cerrado' }, 409)
  }

  const actor = { email: u.u, name: u.name }
  const updated = applyAction(request, action, actor, (note || '').trim() || null)

  // Menciones (@) en el comentario/nota: se suman como informadores del ítem.
  const mentions = cleanMentions(body.mentions, [me])
  if (mentions.length) {
    const set = new Set([...(Array.isArray(updated.watchers) ? updated.watchers : []).map((x) => String(x).toLowerCase()), ...mentions])
    updated.watchers = [...set]
  }
  await saveRequest(updated)

  // Avisar por correo a TODAS las partes interesadas del ítem, cada una con su rol:
  // solicitante, destinatario, informadores y mencionados. No se auto-notifica
  // (ni al actor ni a quien actúa en su nombre). La mención tiene prioridad de rol.
  const evt = updated.events[updated.events.length - 1]
  const eventType = evt && evt.type
  const cleanNote = (note || '').trim() || null
  const mentionSet = new Set(mentions)
  const exclude = new Set([me, ...principalsFor(me)])
  const byEmail = new Map()
  const add = (email, role) => {
    const e = String(email || '').toLowerCase()
    if (!e || exclude.has(e) || byEmail.has(e)) return
    byEmail.set(e, role)
  }
  add(String(updated.requesterId || '').toLowerCase(), 'requester')
  add(assigneeOf(updated), 'assignee')
  for (const w of (Array.isArray(updated.watchers) ? updated.watchers : [])) {
    add(String(w).toLowerCase(), mentionSet.has(String(w).toLowerCase()) ? 'mention' : 'watcher')
  }
  for (const [email, role] of byEmail) {
    await notifyActivity(email, updated, eventType, actor.name, cleanNote, role)
  }

  return json({ request: updated })
}

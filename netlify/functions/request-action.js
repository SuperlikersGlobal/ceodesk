// POST /api/request-action  { id, action, note }
// Aplica una decisión o interacción sobre una solicitud, con control de acceso:
//   - Destinatario: approve | reject | sign | request_info
//   - Solicitante: provide_info | cancel
//   - Destinatario o solicitante: comment
import { authUser, json } from './_lib/auth.js'
import { getRequest, saveRequest } from './_lib/store.js'
import { applyAction, isOpen, isValidAction, ASSIGNEE_ACTIONS, REQUESTER_ACTIONS } from './_lib/lifecycle.js'
import { canViewRequest, assigneeOf, emailOf } from './_lib/users.js'

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

  const me = emailOf(u)
  const isAssignee = assigneeOf(request) === me
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

  // No re-decidir una solicitud ya cerrada
  if (!isOpen(request.status) && action !== 'comment') {
    return json({ error: 'Esta solicitud ya está cerrada' }, 409)
  }

  const actor = { email: u.u, name: u.name }
  const updated = applyAction(request, action, actor, (note || '').trim() || null)
  await saveRequest(updated)
  return json({ request: updated })
}

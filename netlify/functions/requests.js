// GET  /api/requests        -> solicitudes que el usuario puede ver (con eventos)
// GET  /api/requests?id=..   -> una solicitud (si puede verla)
// POST /api/requests         -> crea una solicitud para un destinatario
import { authUser, json } from './_lib/auth.js'
import { listRequests, getRequest, saveRequest, nextCode } from './_lib/store.js'
import { buildRequest, REQUEST_TYPES, PRIORITIES, isDecisionType } from './_lib/lifecycle.js'
import { canViewRequest, defaultAssignee } from './_lib/users.js'
import { nameFor } from './_lib/org.js'

// Rellena destinatario en solicitudes antiguas (antes todo iba al CEO).
function normalize(r) {
  if (!r) return r
  if (!r.assigneeId) {
    const a = defaultAssignee()
    return { ...r, assigneeId: a, assigneeName: nameFor(a) || 'CEO' }
  }
  if (!r.assigneeName) return { ...r, assigneeName: nameFor(r.assigneeId) || r.assigneeId }
  return r
}

export default async (req) => {
  const u = authUser(req)
  if (!u) return json({ error: 'No autorizado' }, 401)

  if (req.method === 'GET') {
    const id = new URL(req.url).searchParams.get('id')
    if (id) {
      const r = normalize(await getRequest(id))
      // 404 (no 403) para no revelar la existencia de solicitudes ajenas.
      if (!r || !canViewRequest(u, r)) return json({ error: 'Solicitud no encontrada' }, 404)
      return json({ request: r })
    }
    const all = (await listRequests()).map(normalize)
    return json({ requests: all.filter((r) => canViewRequest(u, r)) })
  }

  if (req.method === 'POST') {
    let body
    try { body = await req.json() } catch { return json({ error: 'JSON inválido' }, 400) }

    const assigneeEmail = String(body.assigneeId || '').trim().toLowerCase()
    const assigneeName = assigneeEmail ? nameFor(assigneeEmail) : null

    const errors = []
    if (!body.title || !body.title.trim()) errors.push('el título')
    if (!REQUEST_TYPES.includes(body.type)) errors.push('el tipo')
    if (!assigneeEmail) errors.push('el destinatario')
    else if (!assigneeName) errors.push('un destinatario válido')
    if (!body.context || !body.context.trim()) errors.push('la descripción')
    // El "debido proceso" (recomendación + impacto) solo se exige en decisiones.
    if (isDecisionType(body.type)) {
      if (!body.recommendation || !body.recommendation.trim()) errors.push('la recomendación')
      if (!body.impact || !body.impact.trim()) errors.push('el impacto')
    }
    if (errors.length) {
      return json({ error: 'Faltan campos obligatorios: ' + errors.join(', ') + '.' }, 400)
    }

    const input = {
      title: body.title.trim(),
      type: body.type,
      priority: PRIORITIES.includes(body.priority) ? body.priority : 'medium',
      area: (body.area || '').trim() || null,
      context: body.context.trim(),
      recommendation: (body.recommendation || '').trim() || null,
      impact: (body.impact || '').trim() || null,
      documentName: (body.documentName || '').trim() || null,
      documentUrl: (body.documentUrl || '').trim() || null,
      documentVersion: (body.documentVersion || '').trim() || null,
      dueDate: body.dueDate || null,
    }
    const requester = { email: u.u, name: u.name, title: u.title }
    const assignee = { email: assigneeEmail, name: assigneeName }
    const request = buildRequest(input, await nextCode(), requester, assignee)
    await saveRequest(request)
    return json({ request }, 201)
  }

  return json({ error: 'Método no permitido' }, 405)
}

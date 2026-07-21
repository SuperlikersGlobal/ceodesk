// GET  /api/requests        -> solicitudes que el usuario puede ver (con eventos)
// GET  /api/requests?id=..   -> una solicitud (si puede verla)
// POST /api/requests         -> crea una solicitud para un destinatario
import { authUser, json } from './_lib/auth.js'
import { listRequests, getRequest, saveRequest, nextCode } from './_lib/store.js'
import { buildRequest, REQUEST_TYPES, PRIORITIES, isDecisionType } from './_lib/lifecycle.js'
import { canViewRequest, defaultAssignee } from './_lib/users.js'
import { nameFor } from './_lib/org.js'
import { notifyAssigneeNew } from './_lib/notify.js'

// Rellena campos nuevos en ítems antiguos (destinatario, etiquetas).
function normalize(r) {
  if (!r) return r
  let out = r
  if (!out.assigneeId) {
    const a = defaultAssignee()
    out = { ...out, assigneeId: a, assigneeName: nameFor(a) || 'CEO' }
  } else if (!out.assigneeName) {
    out = { ...out, assigneeName: nameFor(out.assigneeId) || out.assigneeId }
  }
  if (!Array.isArray(out.labels)) out = { ...out, labels: [] }
  return out
}

// Etiquetas: array de textos cortos, sin duplicados (case-insensitive), acotado.
function cleanLabels(v) {
  if (!Array.isArray(v)) return []
  const seen = new Set(); const out = []
  for (const x of v) {
    const s = String(x || '').trim().slice(0, 30)
    if (!s) continue
    const k = s.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k); out.push(s)
    if (out.length >= 8) break
  }
  return out
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
      labels: cleanLabels(body.labels),
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

    // Avisar por correo al destinatario (salvo que se lo asigne a sí mismo).
    if (assigneeEmail !== String(requester.email || '').toLowerCase()) {
      await notifyAssigneeNew(request)
    }

    return json({ request }, 201)
  }

  return json({ error: 'Método no permitido' }, 405)
}

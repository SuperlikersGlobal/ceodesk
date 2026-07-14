// GET  /api/requests        -> lista todas las solicitudes (con eventos)
// GET  /api/requests?id=..   -> una solicitud
// POST /api/requests         -> crea una solicitud (cualquier usuario autenticado)
import { authUser, json } from './_lib/auth.js'
import { listRequests, getRequest, saveRequest, nextCode } from './_lib/store.js'
import { buildRequest, REQUEST_TYPES, PRIORITIES } from './_lib/lifecycle.js'
import { canViewRequest } from './_lib/users.js'

export default async (req) => {
  const u = authUser(req)
  if (!u) return json({ error: 'No autorizado' }, 401)

  if (req.method === 'GET') {
    const id = new URL(req.url).searchParams.get('id')
    if (id) {
      const r = await getRequest(id)
      // 404 (no 403) para no revelar la existencia de solicitudes ajenas.
      if (!r || !canViewRequest(u, r)) return json({ error: 'Solicitud no encontrada' }, 404)
      return json({ request: r })
    }
    // Cada quien ve solo lo que puede: el CEO todo, el líder lo suyo,
    // los delegados además lo de su grupo.
    const all = await listRequests()
    return json({ requests: all.filter((r) => canViewRequest(u, r)) })
  }

  if (req.method === 'POST') {
    let body
    try { body = await req.json() } catch { return json({ error: 'JSON inválido' }, 400) }

    const errors = []
    if (!body.title || !body.title.trim()) errors.push('el título')
    if (!REQUEST_TYPES.includes(body.type)) errors.push('el tipo')
    if (!body.context || !body.context.trim()) errors.push('el contexto')
    if (!body.recommendation || !body.recommendation.trim()) errors.push('la recomendación')
    if (!body.impact || !body.impact.trim()) errors.push('el impacto')
    if (errors.length) {
      return json({ error: 'Faltan campos obligatorios: ' + errors.join(', ') + '.' }, 400)
    }

    const input = {
      title: body.title.trim(),
      type: body.type,
      priority: PRIORITIES.includes(body.priority) ? body.priority : 'medium',
      context: body.context.trim(),
      recommendation: body.recommendation.trim(),
      impact: body.impact.trim(),
      documentName: (body.documentName || '').trim() || null,
      documentUrl: (body.documentUrl || '').trim() || null,
      documentVersion: (body.documentVersion || '').trim() || null,
      dueDate: body.dueDate || null,
    }
    const requester = { email: u.u, name: u.name, title: u.title }
    const request = buildRequest(input, await nextCode(), requester)
    await saveRequest(request)
    return json({ request }, 201)
  }

  return json({ error: 'Método no permitido' }, 405)
}

// GET  /api/seen        -> { seen: { requestId: ISO, ... } } del usuario
// POST /api/seen { id }  -> marca el ítem como visto ahora (limpia su "novedad")
//
// Alimenta el indicador de novedades (loguito rojo) del cliente: un ítem tiene
// novedad si su último evento es posterior a la última vez que el usuario lo vio.
import { authUser, json } from './_lib/auth.js'
import { getSeen, markSeen } from './_lib/store.js'

export default async (req) => {
  const u = authUser(req)
  if (!u) return json({ error: 'No autorizado' }, 401)

  if (req.method === 'GET') {
    return json({ seen: await getSeen(u.u) })
  }

  if (req.method === 'POST') {
    let body; try { body = await req.json() } catch { return json({ error: 'JSON inválido' }, 400) }
    if (!body.id) return json({ error: 'Falta el id' }, 400)
    const ts = new Date().toISOString()
    await markSeen(u.u, String(body.id), ts)
    return json({ id: body.id, ts })
  }

  return json({ error: 'Método no permitido' }, 405)
}

// GET /api/roster -> lista de personas (nombre + correo) para elegir destinatario.
import { authUser, json } from './_lib/auth.js'
import { roster } from './_lib/org.js'

export default async (req) => {
  const u = authUser(req)
  if (!u) return json({ error: 'No autorizado' }, 401)
  return json({ people: roster().map((p) => ({ email: p.email, name: p.name })) })
}

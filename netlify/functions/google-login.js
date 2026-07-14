// Intercambia el credential de Google Sign-In por un token de sesión de CeoDesk.
import { signToken, json } from './_lib/auth.js'
import { verifyGoogleCredential } from './_lib/google.js'
import { getOrCreateUserByEmail, canSupervise } from './_lib/users.js'

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)
  let body
  try { body = await req.json() } catch { return json({ error: 'JSON inválido' }, 400) }

  let g
  try { g = await verifyGoogleCredential(body.credential) }
  catch (e) { return json({ error: e.message }, 401) }

  const user = await getOrCreateUserByEmail(g.email, g.name)
  const sup = canSupervise({ u: user.email, role: user.role })
  const token = signToken({ u: user.email, name: user.name, role: user.role, title: user.title, sup })
  return json({ token, user: { ...user, sup } })
}

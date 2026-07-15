// GET /api/jira-connect -> devuelve la URL de autorización de Atlassian (3LO).
// El cliente navega a esa URL; tras el consentimiento, Atlassian redirige a
// /api/jira-callback. El `state` va firmado y ata el flujo a este usuario.
import { authUser, json } from './_lib/auth.js'
import { jiraEnabled, makeState, authorizeUrl } from './_lib/jira.js'

export default async (req) => {
  const u = authUser(req)
  if (!u) return json({ error: 'No autorizado' }, 401)
  if (!jiraEnabled()) return json({ error: 'Jira no está configurado.' }, 400)
  return json({ url: authorizeUrl(makeState(u.u)) })
}

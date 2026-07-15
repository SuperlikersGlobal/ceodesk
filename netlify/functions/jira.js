// GET  /api/jira   -> espejo vivo: issues abiertos asignados al usuario en Jira.
// POST /api/jira   -> { op: 'disconnect' } elimina la conexión del usuario.
//
// Cada usuario ve SUS propios issues (token OAuth por usuario). Refresco al
// vuelo del access token (rotating refresh tokens: se guarda el nuevo).
import { authUser, json } from './_lib/auth.js'
import { jiraEnabled, fetchMyIssues, projectIssue, refreshTokens } from './_lib/jira.js'
import { getJira, saveJira, deleteJira } from './_lib/store.js'

// Devuelve un registro con access token válido (refrescando si está por vencer).
async function validRecord(email) {
  const rec = await getJira(email)
  if (!rec) return null
  // Margen de 60s para no usar un token a punto de expirar.
  if (rec.expiresAt && rec.expiresAt > Date.now() + 60000) return rec
  const t = await refreshTokens(rec.refreshToken)
  return saveJira(email, {
    accessToken: t.access_token,
    refreshToken: t.refresh_token || rec.refreshToken, // rotating: preferir el nuevo
    expiresAt: Date.now() + (Number(t.expires_in) || 3600) * 1000,
  })
}

export default async (req) => {
  const u = authUser(req)
  if (!u) return json({ error: 'No autorizado' }, 401)
  if (!jiraEnabled()) return json({ enabled: false, connected: false, issues: [] })

  if (req.method === 'POST') {
    let body; try { body = await req.json() } catch { body = {} }
    if (body.op === 'disconnect') { await deleteJira(u.u); return json({ connected: false }) }
    return json({ error: 'Operación no válida.' }, 400)
  }

  try {
    const rec = await validRecord(u.u)
    if (!rec) return json({ enabled: true, connected: false, issues: [] })
    const issues = await fetchMyIssues(rec.accessToken, rec.cloudId)
    return json({
      enabled: true, connected: true, site: rec.siteName || rec.siteUrl,
      issues: issues.map((it) => projectIssue(it, rec.siteUrl)),
    })
  } catch (e) {
    // Token revocado / refresh fallido: pedir reconexión (no es un error duro).
    return json({ enabled: true, connected: false, issues: [], error: 'Jira necesita reconexión.', detail: String(e.message || e).slice(0, 160) })
  }
}

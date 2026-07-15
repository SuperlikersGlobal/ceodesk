// GET /api/jira-callback?code=&state= -> fin del flujo OAuth de Jira.
// Verifica el state (firmado), intercambia el code por tokens, resuelve el sitio
// (cloudId) y guarda los tokens del usuario. Luego redirige de vuelta a la app.
// Es público (Atlassian redirige aquí sin el header Authorization).
import { jiraEnabled, readState, exchangeCode, accessibleResources, appBaseUrl } from './_lib/jira.js'
import { saveJira } from './_lib/store.js'

export default async (req) => {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const oauthError = url.searchParams.get('error')
  const back = (status) => Response.redirect(`${appBaseUrl()}/?jira=${status}#/bandeja`, 302)

  if (oauthError) return back('error')
  if (!jiraEnabled() || !code || !state) return back('error')
  const email = readState(state)
  if (!email) return back('error')

  try {
    const tok = await exchangeCode(code)
    const resources = await accessibleResources(tok.access_token)
    const site = (resources || [])[0] // resource-level: normalmente un único sitio
    if (!site) return back('nosite')
    await saveJira(email, {
      accessToken: tok.access_token,
      refreshToken: tok.refresh_token,
      expiresAt: Date.now() + (Number(tok.expires_in) || 3600) * 1000,
      cloudId: site.id,
      siteUrl: site.url,
      siteName: site.name,
      connectedAt: new Date().toISOString(),
    })
    return back('connected')
  } catch {
    return back('error')
  }
}

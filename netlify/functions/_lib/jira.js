// Integración con Jira Cloud vía OAuth 2.0 (3LO), por usuario. "Espejo vivo":
// CeoDesk refleja los issues asignados a cada persona (Jira → CeoDesk).
// Cada quien conecta SU propio Jira ("Conéctate con Atlassian"); guardamos su
// access/refresh token por usuario y refrescamos solos (rotating refresh tokens).
import { signToken, verifyToken } from './auth.js'

const AUTH_BASE = 'https://auth.atlassian.com'
const API = 'https://api.atlassian.com'
// offline_access = refresh token (no es un permiso de la consola: va en el scope).
const SCOPES = ['read:jira-work', 'read:jira-user', 'write:jira-work', 'offline_access']
const REDIRECT_PATH = '/api/jira-callback'

export function jiraEnabled() {
  return !!(process.env.JIRA_OAUTH_CLIENT_ID && process.env.JIRA_OAUTH_CLIENT_SECRET)
}
function clientId() { return process.env.JIRA_OAUTH_CLIENT_ID || '' }
function clientSecret() { return process.env.JIRA_OAUTH_CLIENT_SECRET || '' }

// Base pública del sitio (para el redirect_uri, que debe coincidir con el registrado).
export function appBaseUrl() {
  return String(process.env.APP_BASE_URL || 'https://ceodesk.superlikers.com').replace(/\/$/, '')
}
function redirectUri() { return appBaseUrl() + REDIRECT_PATH }

// Estado firmado que ata el flujo OAuth al usuario (anti-CSRF). TTL corto.
export function makeState(email) { return signToken({ jira: String(email).toLowerCase() }, 600) }
export function readState(state) { const p = verifyToken(state); return p && p.jira ? p.jira : null }

// URL de autorización (3LO). El usuario consiente y Atlassian redirige al callback.
export function authorizeUrl(state) {
  const q = new URLSearchParams({
    audience: 'api.atlassian.com',
    client_id: clientId(),
    scope: SCOPES.join(' '),
    redirect_uri: redirectUri(),
    state,
    response_type: 'code',
    prompt: 'consent',
  })
  return `${AUTH_BASE}/authorize?${q.toString()}`
}

async function tokenRequest(payload) {
  const r = await fetch(`${AUTH_BASE}/oauth/token`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ client_id: clientId(), client_secret: clientSecret(), ...payload }),
  })
  if (!r.ok) throw new Error(`Jira token ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`)
  return r.json() // { access_token, refresh_token, expires_in, scope }
}

// Intercambia el code por tokens (fin del flujo de autorización).
export function exchangeCode(code) {
  return tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri() })
}
// Renueva con el refresh_token (rotating: hay que guardar el nuevo refresh_token).
export function refreshTokens(refreshToken) {
  return tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken })
}

// Sitios accesibles para el token → cloudId + url del sitio de Jira.
export async function accessibleResources(accessToken) {
  const r = await fetch(`${API}/oauth/token/accessible-resources`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })
  if (!r.ok) throw new Error(`Jira resources ${r.status}`)
  return r.json() // [{ id, url, name, scopes }]
}

// ─── Mapeos puros (testeables) ───────────────────────────────────────────────

// statusCategory de Jira → estado de CeoDesk. Jira: new / indeterminate / done.
export function mapStatus(statusCategoryKey) {
  if (statusCategoryKey === 'done') return 'done'
  if (statusCategoryKey === 'indeterminate') return 'doing'
  return 'todo'
}
const PRIO = { Highest: 'urgent', High: 'high', Medium: 'medium', Low: 'low', Lowest: 'low' }
export function mapPriority(name) { return PRIO[name] || 'medium' }

// Proyecta un issue de la API al shape que consume CeoDesk (con enlace al issue).
export function projectIssue(it, siteUrl) {
  const f = it.fields || {}
  const cat = ((f.status || {}).statusCategory || {}).key || 'new'
  const base = String(siteUrl || '').replace(/\/$/, '')
  return {
    key: it.key,
    summary: f.summary || '(sin título)',
    status: mapStatus(cat),
    jiraStatus: (f.status || {}).name || '',
    priority: mapPriority((f.priority || {}).name),
    type: (f.issuetype || {}).name || 'Tarea',
    project: (f.project || {}).key || '',
    due: f.duedate || null,
    url: base ? `${base}/browse/${it.key}` : null,
  }
}

// JQL del espejo: issues abiertos asignados a la persona.
export const MY_ISSUES_JQL = 'assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC'

// Trae los issues abiertos asignados al usuario (espejo vivo, lectura).
export async function fetchMyIssues(accessToken, cloudId) {
  const r = await fetch(`${API}/ex/jira/${cloudId}/rest/api/3/search/jql`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'content-type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ jql: MY_ISSUES_JQL, maxResults: 100, fields: ['summary', 'status', 'priority', 'duedate', 'issuetype', 'project'] }),
  })
  if (!r.ok) throw new Error(`Jira search ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`)
  const j = await r.json()
  return j.issues || []
}

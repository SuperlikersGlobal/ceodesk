// Sesión sin dependencias externas: tokens tipo JWT firmados con HMAC-SHA256.
// Mismo patrón que sl-crm-live para mantener consistencia entre proyectos.
import { createHmac, timingSafeEqual } from 'node:crypto'

export function secret() {
  return process.env.AUTH_SECRET || 'dev-insecure-secret-change-me'
}

const b64 = (v) => Buffer.from(v).toString('base64url')

export function signToken(payload, ttlSec = 60 * 60 * 12) {
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSec }
  const p = b64(JSON.stringify(body))
  const sig = createHmac('sha256', secret()).update(p).digest('base64url')
  return p + '.' + sig
}

export function verifyToken(token) {
  if (!token || !token.includes('.')) return null
  const [p, sig] = token.split('.')
  const expect = createHmac('sha256', secret()).update(p).digest('base64url')
  if (sig.length !== expect.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null
  let body
  try { body = JSON.parse(Buffer.from(p, 'base64url').toString()) } catch { return null }
  if (!body.exp || body.exp < Math.floor(Date.now() / 1000)) return null
  return body
}

// Extrae y valida el usuario del header Authorization. Devuelve payload o null.
// payload = { u: email, name, role, title }
export function authUser(req) {
  const h = req.headers.get('authorization') || ''
  const token = h.startsWith('Bearer ') ? h.slice(7) : null
  return verifyToken(token)
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

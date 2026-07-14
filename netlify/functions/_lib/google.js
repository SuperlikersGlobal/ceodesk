// Verificación del ID token de Google Sign-In, restringida al dominio permitido.
// Mismo patrón que sl-crm-live.
import { OAuth2Client } from 'google-auth-library'

const client = new OAuth2Client()

export function allowedDomain() {
  return (process.env.ALLOWED_DOMAIN || 'iwin.im').toLowerCase()
}

export function googleEnabled() {
  return !!process.env.GOOGLE_CLIENT_ID
}

// Verifica el credential y devuelve { email, name, picture } o lanza error.
export async function verifyGoogleCredential(credential) {
  const audience = process.env.GOOGLE_CLIENT_ID
  if (!audience) throw new Error('Login con Google no está configurado')
  if (!credential) throw new Error('Falta el credential de Google')

  const ticket = await client.verifyIdToken({ idToken: credential, audience })
  const p = ticket.getPayload()
  if (!p || !p.email) throw new Error('Token de Google inválido')
  if (!p.email_verified) throw new Error('El correo de Google no está verificado')

  const email = String(p.email).toLowerCase()
  const dom = allowedDomain()
  if (email.split('@')[1] !== dom && String(p.hd || '').toLowerCase() !== dom) {
    throw new Error('Solo se permiten cuentas @' + dom)
  }
  return { email, name: p.name || email, picture: p.picture || null }
}

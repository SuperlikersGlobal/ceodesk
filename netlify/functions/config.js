// Config pública para el frontend (sin secretos): Client ID de Google y dominio.
import { json } from './_lib/auth.js'

export default async () => {
  return json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    allowedDomain: (process.env.ALLOWED_DOMAIN || 'iwin.im').toLowerCase(),
    areas: String(process.env.AREAS || '').split(',').map((s) => s.trim()).filter(Boolean),
  })
}

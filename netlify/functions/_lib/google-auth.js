// Autenticación con Google vía cuenta de servicio + delegación de dominio
// (Google Workspace). La usa google-tasks.js para actuar como `luis@iwin.im`
// contra la API de Google Tasks. Mismo patrón que el CRM (sl-crm-live).
import { JWT } from 'google-auth-library'

export function googleSAEnabled() {
  return !!(process.env.GOOGLE_SA_CLIENT_EMAIL && process.env.GOOGLE_SA_PRIVATE_KEY)
}

// La private key suele venir con "\n" escapados al guardarla como variable de entorno.
function privateKey() {
  return (process.env.GOOGLE_SA_PRIVATE_KEY || '').replace(/\\n/g, '\n')
}

// Mintea un access token impersonando `subject` para los scopes pedidos.
export async function accessTokenFor(subject, scopes) {
  // Escotilla de pruebas (como CEODESK_MEMORY_STORE en store.js): permite
  // ejercitar el flujo sin credenciales reales de Google. Nunca se define en prod.
  if (process.env.GOOGLE_SA_FAKE_TOKEN) return process.env.GOOGLE_SA_FAKE_TOKEN
  const client = new JWT({
    email: process.env.GOOGLE_SA_CLIENT_EMAIL,
    key: privateKey(),
    scopes,
    subject, // delegación de dominio: actúa como este usuario de Workspace
  })
  const { access_token } = await client.authorize()
  return access_token
}

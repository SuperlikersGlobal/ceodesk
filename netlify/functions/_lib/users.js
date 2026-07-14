// Usuarios sobre Netlify Blobs. Alta automática al entrar con Google.
// El rol se deriva del correo: CEO_EMAILS => 'ceo', el resto => 'leader'.
import { usersStore } from './store.js'

export function ceoEmails() {
  return String(process.env.CEO_EMAILS || 'luis@iwin.im')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
}

export function roleFor(email) {
  return ceoEmails().includes(String(email).toLowerCase()) ? 'ceo' : 'leader'
}

export function isCeo(user) {
  return !!user && (user.role === 'ceo' || ceoEmails().includes(String(user.u || user.email).toLowerCase()))
}

function titleFor(email, fallbackRole) {
  let map = {}
  try { map = JSON.parse(process.env.USER_TITLES || '{}') } catch { map = {} }
  const key = Object.keys(map).find((k) => k.toLowerCase() === String(email).toLowerCase())
  if (key) return map[key]
  return fallbackRole === 'ceo' ? 'CEO' : 'Líder'
}

// Registra (o actualiza) al usuario al entrar con Google. Devuelve el perfil.
export async function getOrCreateUserByEmail(email, name) {
  email = (email || '').trim().toLowerCase()
  const s = usersStore()
  let rec = await s.get(email, { type: 'json' })
  const role = roleFor(email)
  if (!rec) {
    rec = { email, name: name || email, role, title: titleFor(email, role), createdAt: new Date().toISOString() }
  } else {
    if (name) rec.name = name
    rec.role = role
    if (!rec.title) rec.title = titleFor(email, role)
  }
  rec.lastLogin = new Date().toISOString()
  await s.setJSON(email, rec)
  return { email: rec.email, name: rec.name, role: rec.role, title: rec.title }
}

// Avisos por WhatsApp vía SilvIA (WhatsApp Cloud API), mismo patrón que el CRM.
// Se reutilizan las credenciales del CRM: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID
// y la plantilla aprobada SILVIA_TPL_AVISO (silvia_aviso) con params [de, mensaje].

const GRAPH = process.env.WHATSAPP_GRAPH_URL || 'https://graph.facebook.com/v21.0'

export function waEnabled() {
  return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID)
}

// Resuelve el teléfono de un correo. Preferencia:
//   1) WA_ALERT_PHONES = JSON { "correo": "573..." }  (mínimo, sin PII de todos)
//   2) WHATSAPP_USERS   = JSON { "573...": {"username":"correo"} }  (reusar el del CRM)
export function phoneForEmail(email) {
  const e = String(email || '').toLowerCase()
  if (!e) return null
  try {
    const m = JSON.parse(process.env.WA_ALERT_PHONES || '{}')
    const k = Object.keys(m).find((k) => k.toLowerCase() === e)
    if (k && m[k]) return String(m[k]).replace(/[^\d]/g, '')
  } catch { /* noop */ }
  try {
    const m = JSON.parse(process.env.WHATSAPP_USERS || '{}')
    for (const [phone, u] of Object.entries(m)) {
      if (u && String(u.username || '').toLowerCase() === e) return String(phone).replace(/[^\d]/g, '')
    }
  } catch { /* noop */ }
  return null
}

async function sendTemplate(to, name, lang, bodyParams) {
  const id = process.env.WHATSAPP_PHONE_NUMBER_ID
  const components = bodyParams && bodyParams.length
    ? [{ type: 'body', parameters: bodyParams.map((t) => ({ type: 'text', text: String(t).replace(/\n/g, ' ') })) }]
    : []
  const template = { name, language: { code: lang || 'es' } }
  if (components.length) template.components = components
  const r = await fetch(`${GRAPH}/${id}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'template', template }),
  })
  if (!r.ok) return { ok: false, status: r.status, detail: (await r.text().catch(() => '')).slice(0, 200) }
  return { ok: true }
}

async function sendText(to, body) {
  const id = process.env.WHATSAPP_PHONE_NUMBER_ID
  const r = await fetch(`${GRAPH}/${id}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: String(body || '').slice(0, 4000) } }),
  })
  return r.ok
}

// Avisa por WhatsApp a `email`. Usa la plantilla aprobada (funciona en cualquier
// momento); si no hay plantilla, cae a texto libre (solo entrega dentro de 24 h).
// Best-effort: nunca lanza.
export async function notifyByWhatsApp(email, message, fromName = 'SilvIA') {
  try {
    if (!waEnabled()) return { ok: false, reason: 'not_configured' }
    const phone = phoneForEmail(email)
    if (!phone) return { ok: false, reason: 'no_phone' }
    const tpl = process.env.SILVIA_TPL_AVISO
    if (tpl) {
      const r = await sendTemplate(phone, tpl, process.env.SILVIA_TPL_AVISO_LANG || 'es', [fromName, message])
      if (r.ok) return { ok: true, via: 'template' }
    }
    const ok = await sendText(phone, `🔔 ${fromName}: ${message}`)
    return { ok, via: 'text', reason: ok ? undefined : 'fuera_de_ventana_24h' }
  } catch (e) {
    return { ok: false, reason: 'error', detail: String(e && e.message || e).slice(0, 160) }
  }
}

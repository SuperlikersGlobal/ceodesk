// Envío de correo vía SMTP (Google Workspace), mismo patrón que sl-crm-live.
// nodemailer se importa de forma perezosa: si SMTP no está configurado (p. ej.
// en tests), nunca se carga la dependencia.

export function mailerConfigured() {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASS)
}

export async function sendMail({ to, subject, text, html }) {
  if (!mailerConfigured()) return { ok: false, reason: 'not_configured' }
  if (!to) return { ok: false, reason: 'no_recipient' }
  // Escotilla de pruebas (como CEODESK_MEMORY_STORE): captura el correo en vez de
  // enviarlo, para verificar el cableado sin SMTP real. Nunca se define en prod.
  if (process.env.CEODESK_MAIL_SINK === '1') {
    ;(globalThis.__ceodeskMail = globalThis.__ceodeskMail || []).push({ to, subject, text, html })
    return { ok: true, sink: true }
  }
  const { default: nodemailer } = await import('nodemailer')
  const t = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 465),
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: String(process.env.SMTP_PASS || '').replace(/\s+/g, ''), // las app passwords se pegan con espacios
    },
  })
  const from = process.env.SMTP_FROM || `CeoDesk <${process.env.SMTP_USER}>`
  await t.sendMail({ from, to, subject, text, html })
  return { ok: true }
}

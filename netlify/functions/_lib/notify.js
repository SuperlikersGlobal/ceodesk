// Notificaciones por correo. De momento: avisar al SOLICITANTE cuando su
// solicitud fue atendida por otra persona (el destinatario u otro con acceso).
import { sendMail, mailerConfigured } from './mailer.js'
import { buildAttendedEmail, buildAssignedEmail } from './notify-template.js'

// Envía el aviso al solicitante. Best-effort: nunca lanza (no debe romper la acción).
export async function notifyRequesterAttended(request, eventType, actorName, note) {
  try {
    if (!mailerConfigured()) return { ok: false, reason: 'not_configured' }
    const to = request && request.requesterId
    if (!to) return { ok: false, reason: 'no_recipient' }
    const { subject, text, html } = buildAttendedEmail(request, eventType, actorName, note)
    return await sendMail({ to, subject, text, html })
  } catch (e) {
    return { ok: false, reason: 'error', detail: String(e && e.message || e).slice(0, 160) }
  }
}

// Avisa al DESTINATARIO que le asignaron una solicitud nueva. Best-effort.
export async function notifyAssigneeNew(request) {
  try {
    if (!mailerConfigured()) return { ok: false, reason: 'not_configured' }
    const to = request && request.assigneeId
    if (!to) return { ok: false, reason: 'no_recipient' }
    const { subject, text, html } = buildAssignedEmail(request)
    return await sendMail({ to, subject, text, html })
  } catch (e) {
    return { ok: false, reason: 'error', detail: String(e && e.message || e).slice(0, 160) }
  }
}

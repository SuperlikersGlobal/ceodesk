// Notificaciones por correo. De momento: avisar al SOLICITANTE cuando su
// solicitud fue atendida por otra persona (el destinatario u otro con acceso).
import { sendMail, mailerConfigured } from './mailer.js'
import { buildAttendedEmail, buildAssignedEmail, typeLabelFor } from './notify-template.js'
import { notifyByWhatsApp, waEnabled } from './wa.js'

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

// Aviso por WhatsApp (SilvIA) al destinatario cuando le asignan algo URGENTE.
// Best-effort. Solo entrega si el destinatario tiene teléfono configurado.
export async function alertAssigneeUrgentWa(request) {
  try {
    if (!waEnabled()) return { ok: false, reason: 'not_configured' }
    if (String(request && request.priority).toLowerCase() !== 'urgent') return { ok: false, reason: 'not_urgent' }
    const to = request.assigneeId
    if (!to) return { ok: false, reason: 'no_recipient' }
    const who = request.requesterName || 'Alguien'
    const tipo = typeLabelFor(request.type)
    const msg = `${who} te asignó ${tipo} URGENTE: "${request.title}" (${request.code}).`
    return await notifyByWhatsApp(to, msg)
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

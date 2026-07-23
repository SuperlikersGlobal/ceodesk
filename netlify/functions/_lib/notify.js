// Notificaciones por correo. De momento: avisar al SOLICITANTE cuando su
// solicitud fue atendida por otra persona (el destinatario u otro con acceso).
import { sendMail, mailerConfigured } from './mailer.js'
import { buildActivityEmail, buildAssignedEmail, buildWatcherEmail, typeLabelFor } from './notify-template.js'
import { notifyByWhatsApp, waEnabled } from './wa.js'

// Avisa a UNA persona sobre actividad en un ítem (comentario, respuesta, decisión).
// `forRole` = rol del destinatario ('requester' | 'assignee'). Best-effort.
export async function notifyActivity(to, request, eventType, actorName, note, forRole) {
  try {
    if (!mailerConfigured()) return { ok: false, reason: 'not_configured' }
    if (!to) return { ok: false, reason: 'no_recipient' }
    const { subject, text, html } = buildActivityEmail(request, eventType, actorName, note, forRole)
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

// Avisa a un INFORMADOR que lo sumaron a una solicitud. Best-effort.
export async function notifyWatcherAdded(to, request) {
  try {
    if (!mailerConfigured()) return { ok: false, reason: 'not_configured' }
    if (!to) return { ok: false, reason: 'no_recipient' }
    const { subject, text, html } = buildWatcherEmail(request)
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

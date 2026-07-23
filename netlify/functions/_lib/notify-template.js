// Construcción (pura) del correo que avisa al SOLICITANTE que su solicitud fue
// atendida. Sin dependencias de red: fácil de testear.

// Tipo de evento (del historial) -> frase en español para el asunto/cuerpo.
const VERB = {
  approved: 'aprobó', rejected: 'rechazó', signed: 'firmó', read: 'marcó como leída',
  info_requested: 'pidió más información en', info_provided: 'aportó información a',
  started: 'empezó', completed: 'completó', blocked: 'bloqueó', resumed: 'retomó',
  resolved: 'resolvió', closed: 'cerró', reopened: 'reabrió', cancelled: 'canceló',
  commented: 'comentó',
}

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

// Tipo de ítem -> etiqueta en español (para el correo de asignación).
const TYPE_LABEL = {
  read: 'una lectura', approve: 'una aprobación', sign: 'una firma',
  decide: 'una decisión', task: 'una tarea', bug: 'una incidencia',
}
export function typeLabelFor(type) { return TYPE_LABEL[type] || 'una solicitud' }

export function appBaseUrl() {
  return String(process.env.APP_BASE_URL || 'https://ceodesk.superlikers.com').replace(/\/$/, '')
}
export function verbFor(eventType) { return VERB[eventType] || 'actualizó' }

// Devuelve { subject, text, html } para el aviso de "solicitud atendida".
export function buildAttendedEmail(request, eventType, actorName, note) {
  const verb = verbFor(eventType)
  const code = request.code || ''
  const title = request.title || 'tu solicitud'
  const who = actorName || 'Alguien'
  const link = `${appBaseUrl()}/#/solicitud/${encodeURIComponent(request.id)}`

  const subject = `CeoDesk · ${who} ${verb} ${code}`.replace(/\s+/g, ' ').trim()
  const noteLine = note ? `\nNota: "${note}"` : ''
  const text =
    `Hola,\n\n${who} ${verb} tu solicitud ${code}: "${title}".${noteLine}\n\n` +
    `Ver el detalle:\n${link}\n\n— CeoDesk`

  const noteHtml = note
    ? `<p style="margin:0 0 14px;padding:10px 12px;background:#f4f5fb;border-radius:8px;color:#333"><b>Nota:</b> ${esc(note)}</p>`
    : ''
  const html =
    `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;color:#1a1d2b">
      <h2 style="margin:0 0 4px;font-size:18px">CeoDesk</h2>
      <p style="margin:0 0 16px;color:#626a80">Tu solicitud fue atendida.</p>
      <p style="margin:0 0 6px"><b>${esc(who)}</b> ${esc(verb)} tu solicitud
        <b>${esc(code)}</b>.</p>
      <p style="margin:0 0 14px;font-size:15px">"${esc(title)}"</p>
      ${noteHtml}
      <p style="margin:0 0 18px"><a href="${esc(link)}" style="display:inline-block;background:#4b3ff2;color:#fff;padding:11px 20px;border-radius:9px;text-decoration:none;font-weight:700">Ver el detalle</a></p>
      <p style="color:#9298ad;font-size:12px;margin:0">${esc(link)}</p>
    </div>`

  return { subject, text, html }
}

// Devuelve { subject, text, html } para el aviso de "te asignaron algo nuevo".
export function buildAssignedEmail(request) {
  const tipo = typeLabelFor(request.type)
  const code = request.code || ''
  const title = request.title || 'una solicitud'
  const who = request.requesterName || 'Alguien'
  const link = `${appBaseUrl()}/#/solicitud/${encodeURIComponent(request.id)}`
  const dueLine = request.dueDate ? `\nFecha límite: ${request.dueDate}` : ''

  const subject = `CeoDesk · ${who} te asignó ${tipo} (${code})`.replace(/\s+/g, ' ').trim()
  const text =
    `Hola,\n\n${who} te asignó ${tipo}: "${title}" (${code}).${dueLine}\n\n` +
    `Ábrela aquí:\n${link}\n\n— CeoDesk`

  const dueHtml = request.dueDate
    ? `<p style="margin:0 0 14px;color:#626a80;font-size:13px">Fecha límite: <b>${esc(request.dueDate)}</b></p>`
    : ''
  const html =
    `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;color:#1a1d2b">
      <h2 style="margin:0 0 4px;font-size:18px">CeoDesk</h2>
      <p style="margin:0 0 16px;color:#626a80">Te asignaron ${esc(tipo)}.</p>
      <p style="margin:0 0 6px"><b>${esc(who)}</b> te asignó ${esc(tipo)}
        <b>${esc(code)}</b>.</p>
      <p style="margin:0 0 14px;font-size:15px">"${esc(title)}"</p>
      ${dueHtml}
      <p style="margin:0 0 18px"><a href="${esc(link)}" style="display:inline-block;background:#4b3ff2;color:#fff;padding:11px 20px;border-radius:9px;text-decoration:none;font-weight:700">Abrir la solicitud</a></p>
      <p style="color:#9298ad;font-size:12px;margin:0">${esc(link)}</p>
    </div>`

  return { subject, text, html }
}

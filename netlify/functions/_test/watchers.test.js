// Informadores adicionales (watchers) + menciones (@) en comentarios/notas.
// Ejecutar:  CEODESK_MEMORY_STORE=1 CEODESK_MAIL_SINK=1 SMTP_USER=x SMTP_PASS=y AUTH_SECRET=test node --test
import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.CEODESK_MEMORY_STORE = '1'
process.env.CEODESK_MAIL_SINK = '1'
process.env.SMTP_USER = 'bot@iwin.im'
process.env.SMTP_PASS = 'dummy'
process.env.AUTH_SECRET = 'test-secret'
process.env.CEO_EMAILS = 'luis@iwin.im'
process.env.APP_BASE_URL = 'https://ceodesk.superlikers.com'
process.env.ORG = JSON.stringify({
  'luis@iwin.im': { n: 'Luis', l: null },
  'magali@iwin.im': { n: 'Magalí', l: 'luis@iwin.im' },
  'maisabel@iwin.im': { n: 'María Isabel', l: 'luis@iwin.im' },
  'tati@iwin.im': { n: 'Tatiana', l: 'luis@iwin.im' },
})

const { signToken } = await import('../_lib/auth.js')
const { canViewRequest } = await import('../_lib/users.js')
const requests = (await import('../requests.js')).default
const requestAction = (await import('../request-action.js')).default

function req(method, path, token, body) {
  const headers = new Headers()
  if (token) headers.set('authorization', 'Bearer ' + token)
  if (body) headers.set('content-type', 'application/json')
  return new Request('https://ceodesk.superlikers.com' + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
}
const magali = signToken({ u: 'magali@iwin.im', name: 'Magalí', role: 'leader' })
const luis = signToken({ u: 'luis@iwin.im', name: 'Luis', role: 'ceo' })
const mailbox = () => (globalThis.__ceodeskMail = globalThis.__ceodeskMail || [])

test('informador: ve el ítem, recibe aviso al sumarlo y en cada actividad', async () => {
  mailbox().length = 0
  // Magalí pide aprobación al CEO e informa también a María Isabel (nómina).
  let r = await requests(req('POST', '/api/requests', magali, {
    type: 'approve', title: 'Aumento salarial de un colaborador', assigneeId: 'luis@iwin.im',
    context: 'ctx', recommendation: 'rec', impact: 'imp', watchers: ['maisabel@iwin.im'],
  }))
  const request = (await r.json()).request
  assert.deepEqual(request.watchers, ['maisabel@iwin.im'])
  // María Isabel puede VER el ítem (informador).
  assert.equal(canViewRequest({ u: 'maisabel@iwin.im' }, request), true)
  // Recibió el correo de "te sumaron como informador".
  assert.ok(mailbox().some((m) => m.to === 'maisabel@iwin.im' && /informador/i.test(m.subject)))
  mailbox().length = 0

  // Luis aprueba -> María Isabel (informador) recibe aviso de la actividad.
  await requestAction(req('POST', '/api/request-action', luis, { id: request.id, action: 'approve', note: 'Aprobado' }))
  assert.ok(mailbox().some((m) => m.to === 'maisabel@iwin.im'), 'el informador recibe aviso de la aprobación')
  assert.ok(mailbox().some((m) => m.to === 'magali@iwin.im'), 'la solicitante también')
})

test('mención (@): suma a la persona como informador, la avisa y le da acceso', async () => {
  let r = await requests(req('POST', '/api/requests', magali, {
    type: 'approve', title: 'Otra decisión', assigneeId: 'luis@iwin.im', context: 'c', recommendation: 'r', impact: 'i',
  }))
  const request = (await r.json()).request
  mailbox().length = 0
  // Luis comenta mencionando a Tatiana.
  r = await requestAction(req('POST', '/api/request-action', luis, {
    id: request.id, action: 'comment', note: 'Ojo con esto @Tatiana', mentions: ['tati@iwin.im'],
  }))
  const updated = (await r.json()).request
  assert.ok(updated.watchers.includes('tati@iwin.im'), 'la mención queda como informadora')
  assert.equal(canViewRequest({ u: 'tati@iwin.im' }, updated), true)
  const toTati = mailbox().find((m) => m.to === 'tati@iwin.im')
  assert.ok(toTati, 'la persona mencionada recibe correo')
  assert.match(toTati.html, /Te mencionaron/)
})

test('no se puede informar al solicitante/destinatario ni a desconocidos', async () => {
  const r = await requests(req('POST', '/api/requests', magali, {
    type: 'task', title: 'X', assigneeId: 'luis@iwin.im', context: 'c',
    watchers: ['magali@iwin.im', 'luis@iwin.im', 'noexiste@iwin.im', 'maisabel@iwin.im'],
  }))
  const request = (await r.json()).request
  // Se filtran: solicitante (magali), destinatario (luis) y desconocido; queda solo María Isabel.
  assert.deepEqual(request.watchers, ['maisabel@iwin.im'])
})

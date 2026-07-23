// Avisos bidireccionales (comentario/respuesta a la otra parte) + endpoint /seen.
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
  'carlos@iwin.im': { n: 'Carlos', l: 'luis@iwin.im' },
})

const { signToken } = await import('../_lib/auth.js')
const requests = (await import('../requests.js')).default
const requestAction = (await import('../request-action.js')).default
const seen = (await import('../seen.js')).default

function req(method, path, token, body) {
  const headers = new Headers()
  if (token) headers.set('authorization', 'Bearer ' + token)
  if (body) headers.set('content-type', 'application/json')
  return new Request('https://ceodesk.superlikers.com' + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
}
const luis = signToken({ u: 'luis@iwin.im', name: 'Luis', role: 'ceo' })
const carlos = signToken({ u: 'carlos@iwin.im', name: 'Carlos', role: 'leader' })
const mailbox = () => (globalThis.__ceodeskMail = globalThis.__ceodeskMail || [])

test('comentario del destinatario avisa al solicitante; del solicitante avisa al destinatario', async () => {
  // Carlos (solicitante) crea una tarea para Luis (destinatario).
  let r = await requests(req('POST', '/api/requests', carlos, { type: 'task', title: 'Revisar informe', assigneeId: 'luis@iwin.im', context: 'ctx' }))
  const id = (await r.json()).request.id
  mailbox().length = 0

  // Luis (destinatario) comenta -> avisa al SOLICITANTE (Carlos).
  await requestAction(req('POST', '/api/request-action', luis, { id, action: 'comment', note: 'voy en eso' }))
  assert.equal(mailbox().length, 1)
  assert.equal(mailbox()[0].to, 'carlos@iwin.im')
  assert.match(mailbox()[0].subject, /Luis comentó/)
  mailbox().length = 0

  // Carlos (solicitante) responde -> avisa al DESTINATARIO (Luis). ESTA es la mejora.
  await requestAction(req('POST', '/api/request-action', carlos, { id, action: 'comment', note: 'gracias' }))
  assert.equal(mailbox().length, 1)
  assert.equal(mailbox()[0].to, 'luis@iwin.im')
  assert.match(mailbox()[0].subject, /Carlos comentó/)
})

test('/seen: marca y devuelve la última visita por ítem', async () => {
  let r = await seen(req('GET', '/api/seen', luis))
  const before = (await r.json()).seen
  assert.equal(typeof before, 'object')

  r = await seen(req('POST', '/api/seen', luis, { id: 'req-xyz' }))
  const posted = await r.json()
  assert.equal(posted.id, 'req-xyz')
  assert.ok(posted.ts)

  r = await seen(req('GET', '/api/seen', luis))
  const after = (await r.json()).seen
  assert.equal(after['req-xyz'], posted.ts)
})

test('/seen exige id en POST y autorización', async () => {
  let r = await seen(req('POST', '/api/seen', luis, {}))
  assert.equal(r.status, 400)
  r = await seen(req('GET', '/api/seen', null))
  assert.equal(r.status, 401)
})

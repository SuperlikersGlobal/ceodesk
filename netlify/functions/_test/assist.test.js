// Asistente personal (actúa en nombre de su principal) + gating del aviso WhatsApp.
// Ejecutar:  CEODESK_MEMORY_STORE=1 AUTH_SECRET=test node --test
import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.CEODESK_MEMORY_STORE = '1'
process.env.AUTH_SECRET = 'test-secret'
process.env.CEO_EMAILS = 'luis@iwin.im'
process.env.ASSISTANTS = JSON.stringify({ 'luis@iwin.im': ['sarah@iwin.im'] })
process.env.ORG = JSON.stringify({
  'luis@iwin.im': { n: 'Luis', l: null },
  'sarah@iwin.im': { n: 'Sarah', l: 'luis@iwin.im' },
  'carlos@iwin.im': { n: 'Carlos', l: 'luis@iwin.im' },
  'dan@iwin.im': { n: 'Dan', l: 'luis@iwin.im' },
})

const { signToken } = await import('../_lib/auth.js')
const { assistantsOf, principalsFor, actsAsAssignee } = await import('../_lib/users.js')
const requests = (await import('../requests.js')).default
const requestAction = (await import('../request-action.js')).default

function req(method, path, token, body) {
  const headers = new Headers()
  if (token) headers.set('authorization', 'Bearer ' + token)
  if (body) headers.set('content-type', 'application/json')
  return new Request('https://ceodesk.superlikers.com' + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
}
const tok = (e, n, r) => signToken({ u: e, name: n, role: r || 'leader', asst: principalsFor(e) })
const sarah = tok('sarah@iwin.im', 'Sarah')
const carlos = tok('carlos@iwin.im', 'Carlos')
const dan = tok('dan@iwin.im', 'Dan')

test('mapa de asistentes: relaciones directas e inversas', () => {
  assert.deepEqual(assistantsOf('luis@iwin.im'), ['sarah@iwin.im'])
  assert.deepEqual(principalsFor('sarah@iwin.im'), ['luis@iwin.im'])
  assert.deepEqual(principalsFor('carlos@iwin.im'), [])
  assert.equal(actsAsAssignee({ u: 'sarah@iwin.im' }, { assigneeId: 'luis@iwin.im' }), true)
  assert.equal(actsAsAssignee({ u: 'dan@iwin.im' }, { assigneeId: 'luis@iwin.im' }), false)
})

test('la asistente del CEO puede aprobar lo asignado al CEO', async () => {
  // Carlos le pide una aprobación al CEO (Luis).
  let r = await requests(req('POST', '/api/requests', carlos, {
    type: 'approve', title: 'Aprobar contrato', assigneeId: 'luis@iwin.im',
    context: 'ctx', recommendation: 'rec', impact: 'imp',
  }))
  const id = (await r.json()).request.id
  // Sarah (asistente) la aprueba en nombre de Luis.
  r = await requestAction(req('POST', '/api/request-action', sarah, { id, action: 'approve', note: 'ok' }))
  assert.equal(r.status, 200)
  const updated = (await r.json()).request
  assert.equal(updated.status, 'approved')
  assert.equal(updated.decidedByName, 'Sarah') // auditoría: quién actuó de verdad
})

test('un tercero (no asistente) NO puede actuar sobre lo del CEO', async () => {
  let r = await requests(req('POST', '/api/requests', carlos, {
    type: 'approve', title: 'Otra aprobación', assigneeId: 'luis@iwin.im',
    context: 'ctx', recommendation: 'rec', impact: 'imp',
  }))
  const id = (await r.json()).request.id
  // Dan no ve el ítem (no es solicitante/destinatario/asistente/ancestro) -> 404.
  r = await requestAction(req('POST', '/api/request-action', dan, { id, action: 'approve' }))
  assert.equal(r.status, 404)
})

test('la asistente VE lo asignado a su principal', async () => {
  const r = await requests(req('GET', '/api/requests', sarah))
  const list = (await r.json()).requests
  assert.ok(list.some((x) => x.assigneeId === 'luis@iwin.im'), 'Sarah ve ítems asignados a Luis')
})

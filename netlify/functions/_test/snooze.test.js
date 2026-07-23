// Posponer / reactivar una tarea (snooze) + reactivación automática al responder.
// Ejecutar:  CEODESK_MEMORY_STORE=1 AUTH_SECRET=test node --test
import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.CEODESK_MEMORY_STORE = '1'
process.env.AUTH_SECRET = 'test-secret'
process.env.CEO_EMAILS = 'luis@iwin.im'
process.env.ORG = JSON.stringify({
  'luis@iwin.im': { n: 'Luis', l: null },
  'carlos@iwin.im': { n: 'Carlos', l: 'luis@iwin.im' },
})

const { signToken } = await import('../_lib/auth.js')
const { applyAction, isActionAllowedForType, ASSIGNEE_ACTIONS } = await import('../_lib/lifecycle.js')
const requests = (await import('../requests.js')).default
const requestAction = (await import('../request-action.js')).default

function req(method, path, token, body) {
  const headers = new Headers()
  if (token) headers.set('authorization', 'Bearer ' + token)
  if (body) headers.set('content-type', 'application/json')
  return new Request('https://ceodesk.superlikers.com' + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
}
const luis = signToken({ u: 'luis@iwin.im', name: 'Luis', role: 'ceo' })
const carlos = signToken({ u: 'carlos@iwin.im', name: 'Carlos', role: 'leader' })

test('snooze/unsnooze son acciones válidas para cualquier tipo y del destinatario', () => {
  assert.ok(isActionAllowedForType('snooze', 'approve'))
  assert.ok(isActionAllowedForType('unsnooze', 'task'))
  assert.ok(ASSIGNEE_ACTIONS.includes('snooze') && ASSIGNEE_ACTIONS.includes('unsnooze'))
})

test('applyAction: snooze marca snoozedAt sin cambiar el estado; unsnooze lo limpia', () => {
  const base = { status: 'pending', events: [], snoozedAt: null }
  const s = applyAction(base, 'snooze', { email: 'a@x', name: 'A' }, 'espero anexo')
  assert.ok(s.snoozedAt)
  assert.equal(s.status, 'pending') // no cambia el estado
  const u = applyAction(s, 'unsnooze', { email: 'a@x', name: 'A' }, null)
  assert.equal(u.snoozedAt, null)
})

test('responder (provide_info) reactiva automáticamente una tarea pospuesta', () => {
  const base = { status: 'info_requested', events: [], snoozedAt: '2026-01-01T00:00:00Z' }
  const r = applyAction(base, 'provide_info', { email: 'a@x', name: 'A' }, 'aquí está')
  assert.equal(r.snoozedAt, null)
  assert.equal(r.status, 'in_review')
})

test('end-to-end: el destinatario pospone y reactiva; un tercero no puede', async () => {
  let r = await requests(req('POST', '/api/requests', carlos, { type: 'approve', title: 'X', assigneeId: 'luis@iwin.im', context: 'c', recommendation: 'r', impact: 'i' }))
  const id = (await r.json()).request.id
  // Luis (destinatario) pospone.
  r = await requestAction(req('POST', '/api/request-action', luis, { id, action: 'snooze', note: 'espero aclaración' }))
  assert.equal(r.status, 200)
  assert.ok((await r.json()).request.snoozedAt)
  // Carlos (solicitante) NO puede posponer (acción de destinatario).
  r = await requestAction(req('POST', '/api/request-action', carlos, { id, action: 'snooze' }))
  assert.equal(r.status, 403)
  // Luis reactiva.
  r = await requestAction(req('POST', '/api/request-action', luis, { id, action: 'unsnooze' }))
  assert.equal((await r.json()).request.snoozedAt, null)
})

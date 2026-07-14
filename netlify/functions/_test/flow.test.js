// Prueba de integración de la lógica del backend, con almacén en memoria.
// Ejercita el ciclo completo: crear (líder) → pedir info (CEO) → responder
// (líder) → firmar (CEO), y verifica el control de acceso por rol.
//
// Ejecutar:  CEODESK_MEMORY_STORE=1 AUTH_SECRET=test CEO_EMAILS=luis@iwin.im node --test
import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.CEODESK_MEMORY_STORE = '1'
process.env.AUTH_SECRET = 'test-secret'
process.env.CEO_EMAILS = 'luis@iwin.im'

const { signToken } = await import('../_lib/auth.js')
const requests = (await import('../requests.js')).default
const requestAction = (await import('../request-action.js')).default

function req(method, path, token, body) {
  const headers = new Headers()
  if (token) headers.set('authorization', 'Bearer ' + token)
  if (body) headers.set('content-type', 'application/json')
  return new Request('https://ceodesk.superlikers.com' + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
}

const ceo = signToken({ u: 'luis@iwin.im', name: 'Luis', role: 'ceo', title: 'CEO' })
const leader = signToken({ u: 'ana@iwin.im', name: 'Ana', role: 'leader', title: 'Líder de Producto' })
const other = signToken({ u: 'carlos@iwin.im', name: 'Carlos', role: 'leader' })

test('requiere autenticación', async () => {
  const r = await requests(req('GET', '/api/requests', null))
  assert.equal(r.status, 401)
})

test('el líder crea una solicitud con debido proceso', async () => {
  const r = await requests(req('POST', '/api/requests', leader, {
    type: 'sign', title: 'Contrato RappiPay', priority: 'urgent',
    context: 'Alianza', recommendation: 'Firmar', impact: 'Entramos al ciclo de agosto',
    documentName: 'Contrato.pdf', documentVersion: 'v3',
  }))
  assert.equal(r.status, 201)
  const { request } = await r.json()
  assert.equal(request.status, 'pending')
  assert.equal(request.type, 'sign')
  assert.match(request.code, /^CD-\d+$/)
  assert.equal(request.requesterId, 'ana@iwin.im')
  assert.equal(request.events.length, 1)
  assert.equal(request.events[0].type, 'created')
})

test('rechaza crear sin campos obligatorios', async () => {
  const r = await requests(req('POST', '/api/requests', leader, { type: 'approve', title: 'X' }))
  assert.equal(r.status, 400)
})

test('ciclo completo: pedir info → responder → firmar', async () => {
  const created = await (await requests(req('POST', '/api/requests', leader, {
    type: 'sign', title: 'Contrato', context: 'c', recommendation: 'r', impact: 'i',
  }))).json()
  const id = created.request.id

  // un líder NO puede firmar
  let r = await requestAction(req('POST', '/api/request-action', leader, { id, action: 'sign' }))
  assert.equal(r.status, 403)

  // el CEO pide más info (requiere nota)
  r = await requestAction(req('POST', '/api/request-action', ceo, { id, action: 'request_info', note: '¿CAC?' }))
  assert.equal(r.status, 200)
  assert.equal((await r.json()).request.status, 'info_requested')

  // otro líder ni siquiera ve la solicitud → 404 (no revela su existencia)
  r = await requestAction(req('POST', '/api/request-action', other, { id, action: 'provide_info', note: 'x' }))
  assert.equal(r.status, 404)

  // el solicitante responde → vuelve a revisión
  r = await requestAction(req('POST', '/api/request-action', leader, { id, action: 'provide_info', note: 'CAC 42' }))
  assert.equal((await r.json()).request.status, 'in_review')

  // el CEO firma → registro de decisión
  r = await requestAction(req('POST', '/api/request-action', ceo, { id, action: 'sign', note: 'Verificado' }))
  const signed = (await r.json()).request
  assert.equal(signed.status, 'signed')
  assert.equal(signed.decidedByName, 'Luis')
  assert.equal(signed.decisionNote, 'Verificado')
  assert.ok(signed.decidedAt)

  // no se puede re-decidir una cerrada
  r = await requestAction(req('POST', '/api/request-action', ceo, { id, action: 'approve' }))
  assert.equal(r.status, 409)

  // el historial refleja toda la secuencia
  const types = signed.events.map((e) => e.type)
  assert.deepEqual(types, ['created', 'info_requested', 'info_provided', 'signed'])
})

test('GET por id devuelve la solicitud; id inexistente = 404', async () => {
  const created = await (await requests(req('POST', '/api/requests', leader, {
    type: 'approve', title: 'T', context: 'c', recommendation: 'r', impact: 'i',
  }))).json()
  let r = await requests(req('GET', '/api/requests?id=' + created.request.id, ceo))
  assert.equal(r.status, 200)
  r = await requests(req('GET', '/api/requests?id=noexiste', ceo))
  assert.equal(r.status, 404)
})

test('privacidad: un líder NO ve las solicitudes de otro', async () => {
  const created = (await (await requests(req('POST', '/api/requests', leader, {
    type: 'approve', title: 'Privado de Ana', context: 'c', recommendation: 'r', impact: 'i',
  }))).json()).request

  // Otro líder: no aparece en la lista y por id da 404 (no revela existencia)
  const list = (await (await requests(req('GET', '/api/requests', other))).json()).requests
  assert.ok(!list.some((r) => r.id === created.id), 'carlos no debe ver la de ana')
  assert.equal((await requests(req('GET', '/api/requests?id=' + created.id, other))).status, 404)
  // Tampoco puede actuar sobre ella (404: ni siquiera la ve)
  assert.equal((await requestAction(req('POST', '/api/request-action', other, { id: created.id, action: 'approve' }))).status, 404)

  // La solicitante sí la ve; el CEO también
  assert.ok((await (await requests(req('GET', '/api/requests', leader))).json()).requests.some((r) => r.id === created.id))
  assert.ok((await (await requests(req('GET', '/api/requests', ceo))).json()).requests.some((r) => r.id === created.id))
})

test('delegación: un supervisor ve el grupo asignado pero no puede decidir', async () => {
  process.env.VIEWER_DELEGATIONS = JSON.stringify({ 'angela@iwin.im': ['ana@iwin.im'] })
  const angela = signToken({ u: 'angela@iwin.im', name: 'Ángela', role: 'leader' })
  const created = (await (await requests(req('POST', '/api/requests', leader, {
    type: 'sign', title: 'Para supervisar', context: 'c', recommendation: 'r', impact: 'i',
  }))).json()).request

  // Ángela ve la de Ana (delegada); Carlos (sin delegación) no
  assert.ok((await (await requests(req('GET', '/api/requests', angela))).json()).requests.some((r) => r.id === created.id))
  assert.ok(!(await (await requests(req('GET', '/api/requests', other))).json()).requests.some((r) => r.id === created.id))
  // Ángela puede verla por id, pero no decidir (no es CEO ni solicitante)
  assert.equal((await requests(req('GET', '/api/requests?id=' + created.id, angela))).status, 200)
  assert.equal((await requestAction(req('POST', '/api/request-action', angela, { id: created.id, action: 'sign' }))).status, 403)
  delete process.env.VIEWER_DELEGATIONS
})

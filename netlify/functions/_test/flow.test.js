// Pruebas de integración del backend con el modelo "cualquiera a cualquiera" +
// visibilidad por organigrama. Almacén en memoria.
//
// Ejecutar:  CEODESK_MEMORY_STORE=1 AUTH_SECRET=test node --test
import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.CEODESK_MEMORY_STORE = '1'
process.env.AUTH_SECRET = 'test-secret'
process.env.CEO_EMAILS = 'luis@iwin.im'
process.env.CHIEF_OF_STAFF = 'tatiana@iwin.im'
process.env.ORG = JSON.stringify({
  'luis@iwin.im': { n: 'Luis', l: null },
  'tatiana@iwin.im': { n: 'Tatiana', l: 'luis@iwin.im' },
  'angela@iwin.im': { n: 'Ángela', l: 'luis@iwin.im' },
  'santiago@iwin.im': { n: 'Santiago', l: 'angela@iwin.im' },
  'carlos@iwin.im': { n: 'Carlos', l: 'luis@iwin.im' },
  'ana@iwin.im': { n: 'Ana', l: 'tatiana@iwin.im' },
})

const { signToken } = await import('../_lib/auth.js')
const requests = (await import('../requests.js')).default
const requestAction = (await import('../request-action.js')).default

function req(method, path, token, body) {
  const headers = new Headers()
  if (token) headers.set('authorization', 'Bearer ' + token)
  if (body) headers.set('content-type', 'application/json')
  return new Request('https://ceodesk.superlikers.com' + path, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  })
}
const tok = (email, name, role) => signToken({ u: email, name, role: role || 'leader' })
const luis = tok('luis@iwin.im', 'Luis', 'ceo')
const tatiana = tok('tatiana@iwin.im', 'Tatiana')
const angela = tok('angela@iwin.im', 'Ángela')
const santiago = tok('santiago@iwin.im', 'Santiago')
const carlos = tok('carlos@iwin.im', 'Carlos')
const ana = tok('ana@iwin.im', 'Ana')

// Crea una solicitud de `token` dirigida a `to` (email). Devuelve la solicitud.
async function create(token, to, extra = {}) {
  const r = await requests(req('POST', '/api/requests', token, {
    type: 'approve', title: 'T', context: 'c', recommendation: 'r', impact: 'i', assigneeId: to, ...extra,
  }))
  assert.equal(r.status, 201, 'create ' + (await r.clone().text()))
  return (await r.json()).request
}
const list = async (token) => (await (await requests(req('GET', '/api/requests', token))).json()).requests
const has = (rows, id) => rows.some((r) => r.id === id)

test('requiere autenticación', async () => {
  assert.equal((await requests(req('GET', '/api/requests', null))).status, 401)
})

test('crear exige destinatario válido', async () => {
  assert.equal((await requests(req('POST', '/api/requests', ana, { type: 'approve', title: 'T', context: 'c', recommendation: 'r', impact: 'i' }))).status, 400)
  assert.equal((await requests(req('POST', '/api/requests', ana, { type: 'approve', title: 'T', context: 'c', recommendation: 'r', impact: 'i', assigneeId: 'nadie@iwin.im' }))).status, 400)
  const ok = await create(ana, 'carlos@iwin.im')
  assert.equal(ok.assigneeId, 'carlos@iwin.im')
  assert.equal(ok.assigneeName, 'Carlos')
  assert.equal(ok.requesterId, 'ana@iwin.im')
})

test('any-to-any: el destinatario (no el CEO) decide', async () => {
  const r = await create(ana, 'carlos@iwin.im') // Ana pide a Carlos
  // Un tercero sin relación ni siquiera la ve
  assert.equal((await requestAction(req('POST', '/api/request-action', santiago, { id: r.id, action: 'approve' }))).status, 404)
  // El destinatario pide info; la solicitante responde; el destinatario aprueba
  assert.equal((await requestAction(req('POST', '/api/request-action', carlos, { id: r.id, action: 'request_info', note: '¿?' }))).status, 200)
  assert.equal((await requestAction(req('POST', '/api/request-action', ana, { id: r.id, action: 'provide_info', note: 'ok' }))).status, 200)
  const done = (await (await requestAction(req('POST', '/api/request-action', carlos, { id: r.id, action: 'approve', note: 'listo' }))).json()).request
  assert.equal(done.status, 'approved')
  assert.equal(done.decidedByName, 'Carlos')
  // Ana (solicitante) no puede aprobar lo suyo
  const r2 = await create(ana, 'carlos@iwin.im')
  assert.equal((await requestAction(req('POST', '/api/request-action', ana, { id: r2.id, action: 'approve' }))).status, 403)
})

test('organigrama: el líder ve lo que su equipo envía Y lo que le asignan', async () => {
  const enviada = await create(santiago, 'luis@iwin.im')   // Santiago (reporta a Ángela) envía
  const recibida = await create(carlos, 'santiago@iwin.im') // a Santiago le asignan algo
  // Ángela (jefa de Santiago) ve ambas
  const ang = await list(angela)
  assert.ok(has(ang, enviada.id), 'Ángela ve lo que envía Santiago')
  assert.ok(has(ang, recibida.id), 'Ángela ve lo que le asignan a Santiago')
  // Carlos (no es jefe de Santiago) no ve la que Santiago envió a Luis
  assert.ok(!has(await list(carlos), enviada.id))
})

test('transitividad: el CEO ve todo; un nivel intermedio ve su subárbol', async () => {
  const r = await create(santiago, 'ana@iwin.im') // Santiago -> Ana
  assert.ok(has(await list(luis), r.id), 'Luis (raíz) ve todo')
  // Ángela es ancestro de Santiago -> lo ve
  assert.ok(has(await list(angela), r.id))
})

test('Chief of Staff ve todo lo asignado al CEO', async () => {
  const r = await create(carlos, 'luis@iwin.im') // Carlos pide al CEO; Carlos no está en el subárbol de Tatiana
  assert.ok(has(await list(tatiana), r.id), 'Tatiana ve la bandeja del CEO')
  // Ángela NO la ve (Carlos no es su reporte y no es asignada a su equipo)
  assert.ok(!has(await list(angela), r.id))
})

test('tipo Tarea: sin debido proceso; ciclo por-hacer -> en curso -> hecha', async () => {
  const r = (await (await requests(req('POST', '/api/requests', ana, { type: 'task', title: 'Diseñar banner', context: 'detalle', assigneeId: 'carlos@iwin.im' }))).json()).request
  assert.equal(r.status, 'todo')
  // 'approve' no aplica a una tarea
  assert.equal((await requestAction(req('POST', '/api/request-action', carlos, { id: r.id, action: 'approve' }))).status, 400)
  // solo el destinatario la mueve
  assert.equal((await requestAction(req('POST', '/api/request-action', ana, { id: r.id, action: 'start' }))).status, 403)
  assert.equal((await (await requestAction(req('POST', '/api/request-action', carlos, { id: r.id, action: 'start' }))).json()).request.status, 'doing')
  const done = (await (await requestAction(req('POST', '/api/request-action', carlos, { id: r.id, action: 'complete', note: 'listo' }))).json()).request
  assert.equal(done.status, 'done')
  assert.equal(done.decidedByName, 'Carlos')
})

test('la decisión sigue exigiendo recomendación e impacto', async () => {
  assert.equal((await requests(req('POST', '/api/requests', ana, { type: 'approve', title: 'X', context: 'c', assigneeId: 'carlos@iwin.im' }))).status, 400)
})

test('privacidad entre pares: sin relación, no se ve', async () => {
  const r = await create(carlos, 'ana@iwin.im') // Carlos -> Ana
  assert.ok(!has(await list(santiago), r.id), 'Santiago no ve lo de Carlos->Ana')
  assert.equal((await requests(req('GET', '/api/requests?id=' + r.id, santiago))).status, 404)
  // Requester y assignee sí
  assert.ok(has(await list(carlos), r.id))
  assert.ok(has(await list(ana), r.id))
})

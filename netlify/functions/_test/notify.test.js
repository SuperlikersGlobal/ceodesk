// Pruebas del constructor (puro) del correo de "solicitud atendida".
// Ejecutar:  node --test
import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.APP_BASE_URL = 'https://ceodesk.superlikers.com'
const { buildActivityEmail, buildAssignedEmail, verbFor, typeLabelFor } = await import('../_lib/notify-template.js')

const req = { id: 'abc-123', code: 'CD-42', title: 'Aprobar presupuesto Q3', requesterId: 'ana@iwin.im' }

test('verbFor traduce el tipo de evento a español', () => {
  assert.equal(verbFor('approved'), 'aprobó')
  assert.equal(verbFor('rejected'), 'rechazó')
  assert.equal(verbFor('info_requested'), 'pidió más información en')
  assert.equal(verbFor('commented'), 'comentó')
  assert.equal(verbFor('desconocido'), 'actualizó')
})

test('buildActivityEmail arma asunto, texto y enlace al detalle', () => {
  const m = buildActivityEmail(req, 'approved', 'Luis', null, 'requester')
  assert.equal(m.subject, 'CeoDesk · Luis aprobó CD-42')
  assert.match(m.text, /Luis aprobó la solicitud CD-42: "Aprobar presupuesto Q3"/)
  assert.match(m.text, /ceodesk\.superlikers\.com\/#\/solicitud\/abc-123/)
  assert.match(m.html, /Ver el detalle/)
  assert.match(m.html, /#\/solicitud\/abc-123/)
})

test('buildActivityEmail adapta el encabezado según el rol del destinatario', () => {
  assert.match(buildActivityEmail(req, 'commented', 'Ana', null, 'assignee').html, /Novedad en una solicitud que te asignaron/)
  assert.match(buildActivityEmail(req, 'commented', 'Luis', null, 'requester').html, /Tu solicitud tuvo actividad/)
})

test('buildActivityEmail incluye la nota cuando existe', () => {
  const m = buildActivityEmail(req, 'rejected', 'Luis', 'Falta el anexo financiero', 'requester')
  assert.match(m.text, /Nota: "Falta el anexo financiero"/)
  assert.match(m.html, /Falta el anexo financiero/)
})

test('typeLabelFor traduce el tipo a español', () => {
  assert.equal(typeLabelFor('task'), 'una tarea')
  assert.equal(typeLabelFor('bug'), 'una incidencia')
  assert.equal(typeLabelFor('approve'), 'una aprobación')
  assert.equal(typeLabelFor('otro'), 'una solicitud')
})

test('buildAssignedEmail arma el aviso de nueva asignación con enlace y fecha', () => {
  const asg = { id: 'zz-9', code: 'CD-77', type: 'task', title: 'Preparar informe', requesterName: 'Luis', assigneeId: 'ana@iwin.im', dueDate: '2026-08-05' }
  const m = buildAssignedEmail(asg)
  assert.equal(m.subject, 'CeoDesk · Luis te asignó una tarea (CD-77)')
  assert.match(m.text, /Luis te asignó una tarea: "Preparar informe" \(CD-77\)/)
  assert.match(m.text, /Fecha límite: 2026-08-05/)
  assert.match(m.text, /#\/solicitud\/zz-9/)
  assert.match(m.html, /Abrir la solicitud/)
})

test('buildActivityEmail escapa HTML en título y nota', () => {
  const m = buildActivityEmail(
    { id: 'x', code: 'CD-1', title: '<script>alert(1)</script>', requesterId: 'a@iwin.im' },
    'commented', 'Tati <b>', 'nota & "cosa"', 'assignee',
  )
  assert.ok(!m.html.includes('<script>alert(1)</script>'), 'debe escapar el título')
  assert.match(m.html, /&lt;script&gt;/)
  assert.match(m.html, /&amp;/)
})

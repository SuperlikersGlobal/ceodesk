// Pruebas del constructor (puro) del correo de "solicitud atendida".
// Ejecutar:  node --test
import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.APP_BASE_URL = 'https://ceodesk.superlikers.com'
const { buildAttendedEmail, verbFor } = await import('../_lib/notify-template.js')

const req = { id: 'abc-123', code: 'CD-42', title: 'Aprobar presupuesto Q3', requesterId: 'ana@iwin.im' }

test('verbFor traduce el tipo de evento a español', () => {
  assert.equal(verbFor('approved'), 'aprobó')
  assert.equal(verbFor('rejected'), 'rechazó')
  assert.equal(verbFor('info_requested'), 'pidió más información en')
  assert.equal(verbFor('desconocido'), 'actualizó')
})

test('buildAttendedEmail arma asunto, texto y enlace al detalle', () => {
  const m = buildAttendedEmail(req, 'approved', 'Luis', null)
  assert.equal(m.subject, 'CeoDesk · Luis aprobó CD-42')
  assert.match(m.text, /Luis aprobó tu solicitud CD-42: "Aprobar presupuesto Q3"/)
  assert.match(m.text, /ceodesk\.superlikers\.com\/#\/solicitud\/abc-123/)
  assert.match(m.html, /Ver el detalle/)
  assert.match(m.html, /#\/solicitud\/abc-123/)
})

test('buildAttendedEmail incluye la nota cuando existe', () => {
  const m = buildAttendedEmail(req, 'rejected', 'Luis', 'Falta el anexo financiero')
  assert.match(m.text, /Nota: "Falta el anexo financiero"/)
  assert.match(m.html, /Falta el anexo financiero/)
})

test('buildAttendedEmail escapa HTML en título y nota', () => {
  const m = buildAttendedEmail(
    { id: 'x', code: 'CD-1', title: '<script>alert(1)</script>', requesterId: 'a@iwin.im' },
    'commented', 'Tati <b>', 'nota & "cosa"',
  )
  assert.ok(!m.html.includes('<script>alert(1)</script>'), 'debe escapar el título')
  assert.match(m.html, /&lt;script&gt;/)
  assert.match(m.html, /&amp;/)
})

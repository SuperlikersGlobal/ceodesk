// Aviso por WhatsApp (SilvIA): resolución de teléfono y gating. Sin red.
// Ejecutar:  node --test
import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.WA_ALERT_PHONES = JSON.stringify({ 'luis@iwin.im': '57 305 745 4823' })
process.env.WHATSAPP_USERS = JSON.stringify({ '573006248367': { username: 'mcampo@iwin.im', name: 'Camila' } })

const { phoneForEmail, waEnabled } = await import('../_lib/wa.js')
const { alertAssigneeUrgentWa } = await import('../_lib/notify.js')

test('phoneForEmail resuelve por WA_ALERT_PHONES y limpia el número', () => {
  assert.equal(phoneForEmail('luis@iwin.im'), '573057454823')
  assert.equal(phoneForEmail('LUIS@iwin.im'), '573057454823')
})

test('phoneForEmail cae a WHATSAPP_USERS (formato del CRM)', () => {
  assert.equal(phoneForEmail('mcampo@iwin.im'), '573006248367')
  assert.equal(phoneForEmail('nadie@iwin.im'), null)
})

test('waEnabled es false sin token/phone_number_id', () => {
  assert.equal(waEnabled(), false)
})

test('alertAssigneeUrgentWa no envía si no está configurado ni si no es urgente', async () => {
  const urgent = { assigneeId: 'luis@iwin.im', priority: 'urgent', type: 'task', title: 'X', code: 'CD-1', requesterName: 'Ana' }
  const normal = { ...urgent, priority: 'high' }
  // WhatsApp no configurado -> not_configured (aunque sea urgente).
  assert.equal((await alertAssigneeUrgentWa(urgent)).reason, 'not_configured')
  assert.equal((await alertAssigneeUrgentWa(normal)).reason, 'not_configured')
})

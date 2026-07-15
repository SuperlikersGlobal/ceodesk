// Pruebas de los helpers puros de la integración Jira (sin red): mapeo de
// estados/prioridad, proyección de issues, URL de autorización y state firmado.
//
// Ejecutar:  AUTH_SECRET=test node --test
import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.AUTH_SECRET = process.env.AUTH_SECRET || 'test-secret'
process.env.JIRA_OAUTH_CLIENT_ID = 'test-client-id'
process.env.JIRA_OAUTH_CLIENT_SECRET = 'test-secret-value'
process.env.APP_BASE_URL = 'https://ceodesk.superlikers.com'

const jira = await import('../_lib/jira.js')

test('jiraEnabled requiere client id + secret', () => {
  assert.equal(jira.jiraEnabled(), true)
})

test('mapStatus: statusCategory de Jira -> estado CeoDesk', () => {
  assert.equal(jira.mapStatus('new'), 'todo')
  assert.equal(jira.mapStatus('indeterminate'), 'doing')
  assert.equal(jira.mapStatus('done'), 'done')
  assert.equal(jira.mapStatus(undefined), 'todo')
})

test('mapPriority: nombres de Jira -> prioridad CeoDesk', () => {
  assert.equal(jira.mapPriority('Highest'), 'urgent')
  assert.equal(jira.mapPriority('High'), 'high')
  assert.equal(jira.mapPriority('Medium'), 'medium')
  assert.equal(jira.mapPriority('Lowest'), 'low')
  assert.equal(jira.mapPriority('Raro'), 'medium')
})

test('projectIssue proyecta campos y arma el enlace /browse/KEY', () => {
  const it = {
    key: 'SUP-42',
    fields: {
      summary: 'Arreglar el login',
      status: { name: 'En curso', statusCategory: { key: 'indeterminate' } },
      priority: { name: 'High' },
      issuetype: { name: 'Bug' },
      project: { key: 'SUP' },
      duedate: '2026-08-01',
    },
  }
  const p = jira.projectIssue(it, 'https://superlikers2019.atlassian.net/')
  assert.equal(p.key, 'SUP-42')
  assert.equal(p.summary, 'Arreglar el login')
  assert.equal(p.status, 'doing')
  assert.equal(p.jiraStatus, 'En curso')
  assert.equal(p.priority, 'high')
  assert.equal(p.type, 'Bug')
  assert.equal(p.project, 'SUP')
  assert.equal(p.due, '2026-08-01')
  assert.equal(p.url, 'https://superlikers2019.atlassian.net/browse/SUP-42')
})

test('projectIssue tolera issue casi vacío', () => {
  const p = jira.projectIssue({ key: 'X-1', fields: {} }, '')
  assert.equal(p.status, 'todo')
  assert.equal(p.summary, '(sin título)')
  assert.equal(p.url, null)
})

test('authorizeUrl incluye scopes (con offline_access), redirect y client_id', () => {
  const url = jira.authorizeUrl('abc')
  assert.match(url, /^https:\/\/auth\.atlassian\.com\/authorize\?/)
  assert.match(url, /client_id=test-client-id/)
  assert.match(url, /response_type=code/)
  assert.match(url, /prompt=consent/)
  const dec = decodeURIComponent(url)
  assert.ok(dec.includes('offline_access'), 'debe pedir offline_access')
  assert.ok(dec.includes('read:jira-work'), 'debe pedir read:jira-work')
  assert.ok(dec.includes('https://ceodesk.superlikers.com/api/jira-callback'), 'redirect correcto')
  assert.ok(dec.includes('state=abc'))
})

test('makeState/readState: ida y vuelta firmada; rechaza basura', () => {
  const s = jira.makeState('ANA@iwin.im')
  assert.equal(jira.readState(s), 'ana@iwin.im') // normaliza a minúsculas
  assert.equal(jira.readState('no-es-un-token'), null)
  assert.equal(jira.readState(s + 'tampered'), null)
})

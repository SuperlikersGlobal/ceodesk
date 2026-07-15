// Pruebas de los helpers puros del contrato Google Tasks (§4 del contrato).
// No tocan la red: validan el formato de `notes`, la huella y el marcador `· meta`.
//
// Ejecutar:  node --test
import { test } from 'node:test'
import assert from 'node:assert/strict'

const {
  cleanNotes, fingerprintOf, metaOf, buildMetaLine, composeCreateNotes, composeEditNotes,
} = await import('../_lib/google-tasks.js')

test('fingerprintOf lee la huella · LADCC-XXXX al final', () => {
  assert.equal(fingerprintOf('Revisar contrato\n· LADCC-1234'), 'LADCC-1234')
  assert.equal(fingerprintOf('Sin huella'), null)
  assert.equal(fingerprintOf('· LADCC-7'), 'LADCC-7')
})

test('metaOf parsea el marcador y convierte _ en espacios', () => {
  assert.deepEqual(metaOf('Tarea\n· meta cat=Comercial imp=Alta urg=Pronto'), { cat: 'Comercial', imp: 'Alta', urg: 'Pronto' })
  assert.deepEqual(metaOf('Tarea\n· meta cat=Super_Meseros'), { cat: 'Super Meseros' })
  assert.equal(metaOf('Tarea sin meta'), null)
})

test('cleanNotes quita huella y meta de la descripción visible (§4.4)', () => {
  assert.equal(cleanNotes('Revisar propuesta\n· LADCC-99'), 'Revisar propuesta')
  assert.equal(cleanNotes('Preparar demo\n· meta cat=Producto imp=Alta'), 'Preparar demo')
  assert.equal(cleanNotes('Solo texto'), 'Solo texto')
  assert.equal(cleanNotes(''), '')
})

test('buildMetaLine arma la línea con guion bajo para espacios; vacía sin claves', () => {
  assert.equal(buildMetaLine({ cat: 'Super Meseros', imp: 'Alta', urg: 'Pronto' }), '· meta cat=Super_Meseros imp=Alta urg=Pronto')
  assert.equal(buildMetaLine({ cat: 'Comercial' }), '· meta cat=Comercial')
  assert.equal(buildMetaLine({}), '')
})

test('composeCreateNotes pone el marcador · meta como última línea', () => {
  assert.equal(
    composeCreateNotes('Llamar al proveedor', { cat: 'Comercial', urg: 'Hoy' }),
    'Llamar al proveedor\n· meta cat=Comercial urg=Hoy',
  )
  assert.equal(composeCreateNotes('Sin meta', {}), 'Sin meta')
})

test('composeEditNotes PRESERVA la huella al reescribir notes (§6.3)', () => {
  assert.equal(composeEditNotes('Texto nuevo', 'Texto viejo\n· LADCC-555'), 'Texto nuevo\n· LADCC-555')
  // Sin huella previa: solo la descripción.
  assert.equal(composeEditNotes('Texto nuevo', 'Texto viejo'), 'Texto nuevo')
  // Nunca inventa una huella si no existía.
  assert.equal(fingerprintOf(composeEditNotes('X', 'Y')), null)
})

test('ida y vuelta: crear con meta, LADCC lo reemplaza por huella, se limpia igual', () => {
  const created = composeCreateNotes('Enviar reporte', { cat: 'BI', imp: 'Media' })
  assert.equal(metaOf(created).cat, 'BI')
  // Simula el estado tras la importación de LADCC (meta consumido → huella).
  const afterSync = 'Enviar reporte\n· LADCC-2001'
  assert.equal(fingerprintOf(afterSync), 'LADCC-2001')
  assert.equal(cleanNotes(afterSync), 'Enviar reporte')
})

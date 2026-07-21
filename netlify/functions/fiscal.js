// GET  /api/fiscal           -> lista obligaciones (filtros: country, status, entity)
// GET  /api/fiscal?seed=1    -> siembra datos iniciales (solo admin / CEO)
// POST /api/fiscal           -> crea obligación
// PUT  /api/fiscal           -> actualiza obligación (body.id requerido)
// DELETE /api/fiscal?id=..   -> elimina obligación (solo admin / CEO)
import { authUser, json } from './_lib/auth.js'
import { getStore } from '@netlify/blobs'

function store() {
  return getStore('ceodesk-fiscal')
}

async function listObligations() {
  const s = store()
  const { blobs } = await s.list()
  const items = await Promise.all(blobs.map((b) => s.get(b.key, { type: 'json' })))
  return items.filter(Boolean).sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))
}

async function getObligation(id) {
  return store().get(id, { type: 'json' })
}

async function saveObligation(ob) {
  await store().setJSON(ob.id, ob)
  return ob
}

async function deleteObligation(id) {
  await store().delete(id)
}

function uid() {
  return 'fiscal-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7)
}

// ── Catálogo 2026 de obligaciones fiscales por país ────────────────────────
// Se siembra la primera vez (GET /api/fiscal?seed=1)
function seed2026() {
  const now = new Date().toISOString()
  const ob = (country, entities, name, type, due_date, freq, notes = '', responsible = 'Santiago') => ({
    id: uid(),
    country,
    entity_ids: entities,
    obligation_name: name,
    obligation_type: type,
    due_date,
    frequency: freq,
    estimated_amount_usd: null,
    status: new Date(due_date) < new Date() ? 'overdue' : 'pending',
    compliance_date: null,
    notes,
    responsible,
    created_at: now,
    updated_at: now,
  })

  const CO_ALL = ['iwin_col', 'superlikers_col', 'inverpinto', 'ecosistemas']
  const CO_MAIN = ['iwin_col', 'superlikers_col']

  return [
    // ── COLOMBIA ────────────────────────────────────────────────────────────
    // Seguridad social y parafiscales — mensual (cada mes del año)
    ...['2026-02-10','2026-03-10','2026-04-10','2026-05-10','2026-06-10',
        '2026-07-10','2026-08-10','2026-09-10','2026-10-10','2026-11-10','2026-12-10'].map(d =>
      ob('CO', CO_MAIN, 'Seguridad social y parafiscales', 'labor', d, 'monthly',
         'UGPP: SENA, ICBF, Cajas de compensación + salud + pensión')),

    // Retención en la fuente — mensual
    ...['2026-02-26','2026-03-26','2026-04-23','2026-05-26','2026-06-25',
        '2026-07-24','2026-08-25','2026-09-24','2026-10-27','2026-11-25','2026-12-23'].map(d =>
      ob('CO', CO_ALL, 'Retención en la fuente (Formulario 350)', 'tax', d, 'monthly',
         'Grandes contribuyentes: último día hábil del mes siguiente')),

    // IVA bimestral (responsables del régimen común)
    ob('CO', CO_MAIN, 'IVA bimestral — 1er bimestre (Ene-Feb)', 'tax', '2026-03-25', 'bimestral', 'Formulario 300'),
    ob('CO', CO_MAIN, 'IVA bimestral — 2do bimestre (Mar-Abr)', 'tax', '2026-05-25', 'bimestral', 'Formulario 300'),
    ob('CO', CO_MAIN, 'IVA bimestral — 3er bimestre (May-Jun)', 'tax', '2026-07-24', 'bimestral', 'Formulario 300'),
    ob('CO', CO_MAIN, 'IVA bimestral — 4to bimestre (Jul-Ago)', 'tax', '2026-09-24', 'bimestral', 'Formulario 300'),
    ob('CO', CO_MAIN, 'IVA bimestral — 5to bimestre (Sep-Oct)', 'tax', '2026-11-25', 'bimestral', 'Formulario 300'),
    ob('CO', CO_MAIN, 'IVA bimestral — 6to bimestre (Nov-Dic)', 'tax', '2027-01-26', 'bimestral', 'Formulario 300'),

    // Renta — declaración anual
    ob('CO', ['iwin_col'], 'Declaración de Renta — iWin SAS', 'tax', '2026-04-14', 'annual', 'Formulario 110 — DIAN. Fecha exacta según NIT.'),
    ob('CO', ['superlikers_col'], 'Declaración de Renta — Superlikers SAS', 'tax', '2026-04-16', 'annual', 'Formulario 110 — DIAN'),
    ob('CO', ['inverpinto'], 'Declaración de Renta — InverPinto SAS', 'tax', '2026-04-17', 'annual', 'Formulario 110 — DIAN'),
    ob('CO', ['ecosistemas'], 'Declaración de Renta — Ecosistemas XGAIGE SAS', 'tax', '2026-04-20', 'annual', 'Formulario 110 — DIAN'),

    // Información exógena (medios magnéticos)
    ob('CO', CO_ALL, 'Información exógena — Medios magnéticos DIAN', 'reporting', '2026-05-15', 'annual', 'Grandes contribuyentes: abril. Otros: mayo. Verificar con Santiago fecha exacta según NIT.'),

    // Renovación matrícula mercantil
    ob('CO', CO_ALL, 'Renovación matrícula mercantil — Cámara de Comercio', 'compliance', '2026-03-31', 'annual', 'Vence el 31 de marzo. Aplica para todas las SAS colombianas.'),

    // Declaración de activos en el exterior
    ob('CO', ['iwin_col', 'superlikers_col'], 'Declaración de activos en el exterior (Formulario 160)', 'reporting', '2026-10-15', 'annual', 'Aplica por cuentas bancarias y activos en USA/México'),

    // ICA — Industria y Comercio (Bogotá, trimestral)
    ob('CO', CO_MAIN, 'ICA Bogotá — 1er trimestre', 'tax', '2026-05-15', 'quarterly', 'Secretaría de Hacienda Bogotá. Verificar fechas exactas 2026.'),
    ob('CO', CO_MAIN, 'ICA Bogotá — 2do trimestre', 'tax', '2026-08-15', 'quarterly', 'Secretaría de Hacienda Bogotá'),
    ob('CO', CO_MAIN, 'ICA Bogotá — 3er trimestre', 'tax', '2026-11-15', 'quarterly', 'Secretaría de Hacienda Bogotá'),
    ob('CO', CO_MAIN, 'ICA Bogotá — 4to trimestre', 'tax', '2027-02-15', 'quarterly', 'Secretaría de Hacienda Bogotá'),

    // SAGRILAFT
    ob('CO', CO_MAIN, 'Reporte SAGRILAFT — Superintendencia de Sociedades', 'compliance', '2026-04-30', 'annual', 'Sistema de autocontrol para prevención LA/FT. Aplica si activos > 30.000 SMMLV.'),

    // ── MÉXICO ──────────────────────────────────────────────────────────────
    // ISR provisional mensual
    ...['2026-02-17','2026-03-17','2026-04-17','2026-05-18','2026-06-17',
        '2026-07-17','2026-08-17','2026-09-17','2026-10-19','2026-11-17','2026-12-17'].map(d =>
      ob('MX', ['sl_mex'], 'ISR provisional mensual (Personas Morales)', 'tax', d, 'monthly',
         'SAT — Portal del SAT. Régimen General de Ley.')),

    // IVA mensual
    ...['2026-02-17','2026-03-17','2026-04-17','2026-05-18','2026-06-17',
        '2026-07-17','2026-08-17','2026-09-17','2026-10-19','2026-11-17','2026-12-17'].map(d =>
      ob('MX', ['sl_mex'], 'IVA mensual', 'tax', d, 'monthly', 'SAT — tasa 16%')),

    // IMSS / INFONAVIT cuotas patronales
    ...['2026-02-17','2026-03-17','2026-04-17','2026-05-18','2026-06-17',
        '2026-07-17','2026-08-17','2026-09-17','2026-10-19','2026-11-17','2026-12-17'].map(d =>
      ob('MX', ['sl_mex'], 'IMSS + INFONAVIT — cuotas patronales', 'labor', d, 'monthly',
         'SUA — Sistema Único de Autodeterminación')),

    // Declaración anual personas morales
    ob('MX', ['sl_mex'], 'Declaración Anual ISR — Personas Morales 2025', 'tax', '2026-03-31', 'annual', 'SAT — Ejercicio fiscal 2025'),

    // Constancias de retención (CFDI)
    ob('MX', ['sl_mex'], 'Constancias de retenciones e información de pagos', 'reporting', '2026-02-28', 'annual', 'SAT — Formulario 37. Emisión a proveedores y empleados.'),

    // Declaración informativa de operaciones con terceros (DIOT)
    ...['2026-02-17','2026-03-17','2026-04-17','2026-05-18','2026-06-17',
        '2026-07-17','2026-08-17','2026-09-17','2026-10-19','2026-11-17','2026-12-17'].map(d =>
      ob('MX', ['sl_mex'], 'DIOT mensual', 'reporting', d, 'monthly',
         'SAT — Declaración Informativa de Operaciones con Terceros')),

    // PTU — Participación de utilidades a trabajadores
    ob('MX', ['sl_mex'], 'PTU — Participación de utilidades a trabajadores', 'labor', '2026-05-31', 'annual', 'STPS — Personas morales tienen hasta 60 días después de presentar declaración anual.'),

    // ── USA ─────────────────────────────────────────────────────────────────
    // Federal estimated taxes (Q1-Q4 2026)
    ob('US', ['sti_usa','iwin_llc','delca2'], 'Federal estimated tax — Q1 2026 (Form 1120-W)', 'tax', '2026-04-15', 'quarterly', 'IRS — pago estimado de impuestos corporativos'),
    ob('US', ['sti_usa','iwin_llc','delca2'], 'Federal estimated tax — Q2 2026 (Form 1120-W)', 'tax', '2026-06-15', 'quarterly', 'IRS'),
    ob('US', ['sti_usa','iwin_llc','delca2'], 'Federal estimated tax — Q3 2026 (Form 1120-W)', 'tax', '2026-09-15', 'quarterly', 'IRS'),
    ob('US', ['sti_usa','iwin_llc','delca2'], 'Federal estimated tax — Q4 2026 (Form 1120-W)', 'tax', '2026-12-15', 'quarterly', 'IRS'),

    // Payroll taxes
    ob('US', ['iwin_llc'], 'Payroll taxes — Form 941 Q1 2026', 'tax', '2026-04-30', 'quarterly', 'IRS — Employer Quarterly Federal Tax Return'),
    ob('US', ['iwin_llc'], 'Payroll taxes — Form 941 Q2 2026', 'tax', '2026-07-31', 'quarterly', 'IRS'),
    ob('US', ['iwin_llc'], 'Payroll taxes — Form 941 Q3 2026', 'tax', '2026-10-31', 'quarterly', 'IRS'),
    ob('US', ['iwin_llc'], 'Payroll taxes — Form 941 Q4 2026', 'tax', '2027-01-31', 'quarterly', 'IRS'),

    // Form 1099-NEC / 1099-MISC
    ob('US', ['iwin_llc','sti_usa','delca2'], 'Form 1099-NEC — distribución a contratistas', 'reporting', '2026-01-31', 'annual', 'IRS — aplica a todos los contratistas que recibieron >$600 en 2025'),

    // Annual returns
    ob('US', ['sti_usa'], 'Form 1120 — Declaración anual C-Corp (Superlikers Technologies Inc.)', 'tax', '2026-04-15', 'annual', 'IRS — puede extenderse hasta Oct 15 con Form 7004'),
    ob('US', ['iwin_llc'], 'Form 1065 — Declaración anual Partnership (iWin LLC)', 'tax', '2026-03-15', 'annual', 'IRS — puede extenderse hasta Sep 15 con Form 7004'),
    ob('US', ['delca2'], 'Form 1120 — Declaración anual C-Corp o 1065 (Delca2 LLC)', 'tax', '2026-04-15', 'annual', 'Confirmar estructura legal con asesor fiscal USA'),

    // FBAR
    ob('US', ['iwin_col','iwin_llc','sti_usa','delca2'], 'FBAR — FinCEN 114 (cuentas bancarias extranjeras)', 'reporting', '2026-04-15', 'annual', 'BSA E-Filing — aplica si cuentas extranjeras > $10,000. Extensión automática hasta Oct 15.'),

    // Delaware franchise tax
    ob('US', ['sti_usa'], 'Delaware Franchise Tax — Superlikers Technologies Inc.', 'tax', '2026-03-01', 'annual', 'División de Corporaciones de Delaware — Corporations deben pagar antes del 1 de marzo'),
    ob('US', ['iwin_llc','delca2'], 'Delaware Franchise Tax + Annual Report — LLCs', 'tax', '2026-06-01', 'annual', 'División de Corporaciones de Delaware — LLCs: antes del 1 de junio ($300 fijo)'),

    // Form 5471 (si aplica — reporte de corporaciones extranjeras)
    ob('US', ['iwin_col'], 'Form 5471 — Reporte de corporación extranjera controlada', 'reporting', '2026-04-15', 'annual', 'IRS — aplica si US persons controlan >50% de una CFC. Verificar con asesor fiscal.'),
  ]
}

export default async (req) => {
  const u = authUser(req)
  if (!u) return json({ error: 'No autorizado' }, 401)

  const url = new URL(req.url)

  if (req.method === 'GET') {
    const seed = url.searchParams.get('seed')
    if (seed === '1') {
      if (u.role !== 'ceo' && u.role !== 'admin') return json({ error: 'Solo el CEO puede sembrar datos' }, 403)
      const existing = await listObligations()
      if (existing.length > 0) return json({ error: 'Ya hay datos. Seed omitido.', count: existing.length }, 409)
      const items = seed2026()
      await Promise.all(items.map((ob) => store().setJSON(ob.id, ob)))
      return json({ seeded: items.length })
    }

    const country = url.searchParams.get('country')
    const status = url.searchParams.get('status')
    const entity = url.searchParams.get('entity')

    let items = await listObligations()
    if (country) items = items.filter((o) => o.country === country)
    if (status) items = items.filter((o) => o.status === status)
    if (entity) items = items.filter((o) => (o.entity_ids || []).includes(entity))

    return json({ obligations: items })
  }

  if (req.method === 'POST') {
    let body
    try { body = await req.json() } catch { return json({ error: 'JSON inválido' }, 400) }
    if (!body.obligation_name || !body.due_date || !body.country) {
      return json({ error: 'Faltan campos: obligation_name, due_date, country' }, 400)
    }
    const now = new Date().toISOString()
    const ob = {
      id: uid(),
      country: body.country,
      entity_ids: body.entity_ids || [],
      obligation_name: body.obligation_name,
      obligation_type: body.obligation_type || 'tax',
      due_date: body.due_date,
      frequency: body.frequency || 'annual',
      estimated_amount_usd: body.estimated_amount_usd ?? null,
      status: body.status || 'pending',
      compliance_date: body.compliance_date || null,
      notes: body.notes || '',
      responsible: body.responsible || u.name,
      created_at: now,
      updated_at: now,
    }
    await store().setJSON(ob.id, ob)
    return json({ obligation: ob }, 201)
  }

  if (req.method === 'PUT') {
    let body
    try { body = await req.json() } catch { return json({ error: 'JSON inválido' }, 400) }
    if (!body.id) return json({ error: 'id requerido' }, 400)
    const existing = await getObligation(body.id)
    if (!existing) return json({ error: 'No encontrado' }, 404)
    const updated = { ...existing, ...body, id: existing.id, updated_at: new Date().toISOString() }
    await store().setJSON(updated.id, updated)
    return json({ obligation: updated })
  }

  if (req.method === 'DELETE') {
    if (u.role !== 'ceo' && u.role !== 'admin') return json({ error: 'Sin permiso' }, 403)
    const id = url.searchParams.get('id')
    if (!id) return json({ error: 'id requerido' }, 400)
    await deleteObligation(id)
    return json({ ok: true })
  }

  return json({ error: 'Método no permitido' }, 405)
}

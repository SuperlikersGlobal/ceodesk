// GET  /api/fiscal           -> lista obligaciones (auto-siembra el catálogo 2026 si está vacío)
//                               filtros: country, status, entity
// GET  /api/fiscal?reseed=1  -> fuerza recarga del catálogo (solo CEO/admin, idempotente)
// POST /api/fiscal           -> crea obligación
// PUT  /api/fiscal           -> actualiza obligación (body.id requerido)
// DELETE /api/fiscal?id=..   -> elimina obligación (solo CEO/admin)
import { authUser, json } from './_lib/auth.js'
import { getStore } from '@netlify/blobs'

// ── Almacenamiento robusto (Blobs con fallback en memoria) ──────────────────
const mem = new Map()
function memStore() {
  return {
    async get(key, opts) {
      if (!mem.has(key)) return null
      const v = mem.get(key)
      return opts && opts.type === 'json' ? structuredClone(v) : v
    },
    async setJSON(key, val) { mem.set(key, structuredClone(val)) },
    async delete(key) { mem.delete(key) },
    async list() { return { blobs: [...mem.keys()].map((key) => ({ key })) } },
  }
}
function store() {
  try { return getStore('ceodesk-fiscal') } catch { return memStore() }
}

async function listObligations() {
  const s = store()
  const { blobs } = await s.list()
  const items = await Promise.all(blobs.map((b) => s.get(b.key, { type: 'json' })))
  return items.filter(Boolean).sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))
}
async function getObligation(id) { return store().get(id, { type: 'json' }) }

// ID determinista: mismo catálogo => mismos IDs => re-seed idempotente (nunca duplica).
function slug(s) {
  return String(s).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48)
}

// ── Catálogo 2026 de obligaciones fiscales por país ────────────────────────
function seed2026() {
  const now = new Date().toISOString()
  const ob = (country, entities, name, type, due_date, freq, notes = '', responsible = 'Santiago') => {
    const id = 'fiscal-' + country.toLowerCase() + '-' + due_date + '-' + slug(name)
    return {
      id, country, entity_ids: entities,
      obligation_name: name, obligation_type: type,
      due_date, frequency: freq,
      estimated_amount_usd: null,
      status: 'pending',
      compliance_date: null,
      notes, responsible,
      created_at: now, updated_at: now,
    }
  }

  const CO_ALL = ['iwin_col', 'superlikers_col', 'inverpinto', 'ecosistemas']
  const CO_MAIN = ['iwin_col', 'superlikers_col']

  const M = (arr) => arr // helper legibilidad

  return [
    // ══ COLOMBIA ═══════════════════════════════════════════════════════════
    // Seguridad social y parafiscales (mensual, pago mes vencido)
    ...M(['2026-02-10','2026-03-10','2026-04-10','2026-05-08','2026-06-10',
          '2026-07-10','2026-08-11','2026-09-10','2026-10-09','2026-11-10','2026-12-10']).map(d =>
      ob('CO', CO_MAIN, 'Seguridad social y parafiscales (PILA)', 'labor', d, 'monthly',
         'Salud, pensión, ARL + SENA, ICBF, Caja de compensación. Pago vía PILA según dígito NIT.')),

    // Retención en la fuente (Formulario 350, mensual)
    ...M(['2026-02-26','2026-03-26','2026-04-23','2026-05-26','2026-06-25',
          '2026-07-24','2026-08-25','2026-09-24','2026-10-27','2026-11-25','2026-12-23']).map(d =>
      ob('CO', CO_ALL, 'Retención en la fuente (Formulario 350)', 'tax', d, 'monthly',
         'DIAN. Fecha exacta según último dígito del NIT.')),

    // IVA bimestral (Formulario 300)
    ob('CO', CO_MAIN, 'IVA bimestral — Ene/Feb (Formulario 300)', 'tax', '2026-03-11', 'bimestral', 'DIAN'),
    ob('CO', CO_MAIN, 'IVA bimestral — Mar/Abr (Formulario 300)', 'tax', '2026-05-13', 'bimestral', 'DIAN'),
    ob('CO', CO_MAIN, 'IVA bimestral — May/Jun (Formulario 300)', 'tax', '2026-07-13', 'bimestral', 'DIAN'),
    ob('CO', CO_MAIN, 'IVA bimestral — Jul/Ago (Formulario 300)', 'tax', '2026-09-11', 'bimestral', 'DIAN'),
    ob('CO', CO_MAIN, 'IVA bimestral — Sep/Oct (Formulario 300)', 'tax', '2026-11-11', 'bimestral', 'DIAN'),
    ob('CO', CO_MAIN, 'IVA bimestral — Nov/Dic (Formulario 300)', 'tax', '2027-01-13', 'bimestral', 'DIAN'),

    // Declaración de renta persona jurídica (Formulario 110) — 2 cuotas grandes contribuyentes / 1 cuota resto
    ob('CO', ['iwin_col'], 'Declaración de Renta 2025 — iWin SAS (Form. 110)', 'tax', '2026-05-13', 'annual', 'DIAN. Fecha según NIT. Verificar calendario tributario 2026.'),
    ob('CO', ['superlikers_col'], 'Declaración de Renta 2025 — Superlikers SAS (Form. 110)', 'tax', '2026-05-14', 'annual', 'DIAN. Fecha según NIT.'),
    ob('CO', ['inverpinto'], 'Declaración de Renta 2025 — InverPinto SAS (Form. 110)', 'tax', '2026-05-15', 'annual', 'DIAN. Fecha según NIT.'),
    ob('CO', ['ecosistemas'], 'Declaración de Renta 2025 — Ecosistemas XGAIGE SAS (Form. 110)', 'tax', '2026-05-18', 'annual', 'DIAN. Fecha según NIT.'),

    // Información exógena (medios magnéticos)
    ob('CO', CO_ALL, 'Información exógena — Medios magnéticos 2025', 'reporting', '2026-05-15', 'annual', 'DIAN. Fecha según NIT. Grandes contribuyentes suelen ir en abril.'),

    // Renovación matrícula mercantil
    ob('CO', CO_ALL, 'Renovación matrícula mercantil (Cámara de Comercio)', 'compliance', '2026-03-31', 'annual', 'Vence 31 de marzo. Aplica a todas las SAS.'),

    // Declaración activos en el exterior (Formulario 160)
    ob('CO', CO_MAIN, 'Declaración de activos en el exterior (Form. 160)', 'reporting', '2026-05-13', 'annual', 'DIAN. Aplica por cuentas/activos en USA y México. Se presenta con la renta.'),

    // ICA Bogotá (bimestral para grandes; anual para el resto — se deja bimestral)
    ob('CO', CO_MAIN, 'ICA Bogotá — 1er bimestre', 'tax', '2026-03-20', 'bimestral', 'Secretaría de Hacienda Distrital. Verificar periodicidad según ingresos.'),
    ob('CO', CO_MAIN, 'ICA Bogotá — 2do bimestre', 'tax', '2026-05-19', 'bimestral', 'Secretaría de Hacienda Distrital.'),
    ob('CO', CO_MAIN, 'ICA Bogotá — 3er bimestre', 'tax', '2026-07-20', 'bimestral', 'Secretaría de Hacienda Distrital.'),
    ob('CO', CO_MAIN, 'ICA Bogotá — 4to bimestre', 'tax', '2026-09-18', 'bimestral', 'Secretaría de Hacienda Distrital.'),
    ob('CO', CO_MAIN, 'ICA Bogotá — 5to bimestre', 'tax', '2026-11-19', 'bimestral', 'Secretaría de Hacienda Distrital.'),
    ob('CO', CO_MAIN, 'ICA Bogotá — 6to bimestre', 'tax', '2027-01-19', 'bimestral', 'Secretaría de Hacienda Distrital.'),

    // SAGRILAFT / reporte SuperSociedades
    ob('CO', CO_MAIN, 'Reporte SAGRILAFT (Superintendencia de Sociedades)', 'compliance', '2026-04-30', 'annual', 'Aplica si supera umbrales de activos/ingresos. Confirmar obligatoriedad con Santiago.'),

    // ══ MÉXICO ═════════════════════════════════════════════════════════════
    // ISR provisional mensual (día 17)
    ...M(['2026-02-17','2026-03-17','2026-04-17','2026-05-18','2026-06-17',
          '2026-07-17','2026-08-17','2026-09-17','2026-10-19','2026-11-17','2026-12-17']).map(d =>
      ob('MX', ['sl_mex'], 'ISR provisional mensual (Personas Morales)', 'tax', d, 'monthly',
         'SAT. Régimen General de Ley. Se presenta a más tardar el día 17.')),

    // IVA mensual (día 17)
    ...M(['2026-02-17','2026-03-17','2026-04-17','2026-05-18','2026-06-17',
          '2026-07-17','2026-08-17','2026-09-17','2026-10-19','2026-11-17','2026-12-17']).map(d =>
      ob('MX', ['sl_mex'], 'IVA mensual', 'tax', d, 'monthly', 'SAT. Tasa 16%. Día 17.')),

    // IMSS/INFONAVIT (cuotas patronales)
    ...M(['2026-02-17','2026-03-17','2026-04-17','2026-05-18','2026-06-17',
          '2026-07-17','2026-08-17','2026-09-17','2026-10-19','2026-11-17','2026-12-17']).map(d =>
      ob('MX', ['sl_mex'], 'IMSS + INFONAVIT (cuotas patronales)', 'labor', d, 'monthly',
         'SUA. IMSS mensual + bimestral INFONAVIT/RCV.')),

    // DIOT mensual
    ...M(['2026-02-28','2026-03-31','2026-04-30','2026-05-29','2026-06-30',
          '2026-07-31','2026-08-31','2026-09-30','2026-10-30','2026-11-30','2026-12-31']).map(d =>
      ob('MX', ['sl_mex'], 'DIOT (Declaración Informativa de Operaciones con Terceros)', 'reporting', d, 'monthly',
         'SAT. Último día del mes siguiente.')),

    // Declaración anual personas morales
    ob('MX', ['sl_mex'], 'Declaración Anual ISR 2025 (Personas Morales)', 'tax', '2026-03-31', 'annual', 'SAT. Ejercicio fiscal 2025. A más tardar 31 de marzo.'),

    // Constancias de retención
    ob('MX', ['sl_mex'], 'Constancias de retenciones e información de pagos', 'reporting', '2026-02-28', 'annual', 'SAT. Emisión a proveedores/empleados por el ejercicio 2025.'),

    // PTU
    ob('MX', ['sl_mex'], 'PTU — Reparto de utilidades a trabajadores', 'labor', '2026-05-30', 'annual', 'STPS. Dentro de los 60 días tras presentar la declaración anual.'),

    // ══ ESTADOS UNIDOS ═════════════════════════════════════════════════════
    // Estimated taxes (corporativo, trimestral)
    ob('US', ['sti_usa','delca2'], 'Federal estimated tax — Q1 2026 (Form 1120-W)', 'tax', '2026-04-15', 'quarterly', 'IRS. Pago estimado de impuesto corporativo.'),
    ob('US', ['sti_usa','delca2'], 'Federal estimated tax — Q2 2026', 'tax', '2026-06-15', 'quarterly', 'IRS.'),
    ob('US', ['sti_usa','delca2'], 'Federal estimated tax — Q3 2026', 'tax', '2026-09-15', 'quarterly', 'IRS.'),
    ob('US', ['sti_usa','delca2'], 'Federal estimated tax — Q4 2026', 'tax', '2026-12-15', 'quarterly', 'IRS.'),

    // Payroll (Form 941 trimestral) — iWin LLC tiene nómina US
    ob('US', ['iwin_llc'], 'Payroll tax — Form 941 Q4 2025', 'tax', '2026-01-31', 'quarterly', 'IRS. Employer Quarterly Federal Tax Return.'),
    ob('US', ['iwin_llc'], 'Payroll tax — Form 941 Q1 2026', 'tax', '2026-04-30', 'quarterly', 'IRS.'),
    ob('US', ['iwin_llc'], 'Payroll tax — Form 941 Q2 2026', 'tax', '2026-07-31', 'quarterly', 'IRS.'),
    ob('US', ['iwin_llc'], 'Payroll tax — Form 941 Q3 2026', 'tax', '2026-11-02', 'quarterly', 'IRS.'),

    // W-2 / 1099 (informativos, enero)
    ob('US', ['iwin_llc','sti_usa'], 'Form W-2 a empleados + SSA', 'reporting', '2026-02-02', 'annual', 'IRS/SSA. Entrega de W-2 del año 2025.'),
    ob('US', ['iwin_llc','sti_usa','delca2'], 'Form 1099-NEC a contratistas', 'reporting', '2026-02-02', 'annual', 'IRS. Contratistas con pagos > $600 en 2025.'),

    // Declaraciones anuales
    ob('US', ['iwin_llc'], 'Declaración anual — Form 1065 (iWin LLC, Partnership)', 'tax', '2026-03-16', 'annual', 'IRS. Extensión hasta 15-sep con Form 7004.'),
    ob('US', ['sti_usa'], 'Declaración anual — Form 1120 (STI Inc., C-Corp)', 'tax', '2026-04-15', 'annual', 'IRS. Extensión hasta 15-oct con Form 7004.'),
    ob('US', ['delca2'], 'Declaración anual — Delca2 LLC (1120 / 1065)', 'tax', '2026-04-15', 'annual', 'IRS. Confirmar estructura fiscal (C-Corp vs Partnership) con asesor US.'),

    // FBAR
    ob('US', ['iwin_col','iwin_llc','sti_usa','delca2'], 'FBAR — FinCEN Form 114 (cuentas extranjeras)', 'reporting', '2026-04-15', 'annual', 'BSA E-Filing. Si cuentas extranjeras superan $10,000. Extensión automática hasta 15-oct.'),

    // Delaware franchise
    ob('US', ['sti_usa'], 'Delaware Franchise Tax + Annual Report (C-Corp)', 'tax', '2026-03-01', 'annual', 'DE Division of Corporations. Corporations antes del 1 de marzo.'),
    ob('US', ['iwin_llc','delca2'], 'Delaware Franchise Tax (LLCs, $300 fijo)', 'tax', '2026-06-01', 'annual', 'DE Division of Corporations. LLCs antes del 1 de junio.'),

    // BOI (Corporate Transparency Act) — informativo
    ob('US', ['iwin_llc','sti_usa','delca2'], 'BOI Report — Beneficial Ownership (FinCEN)', 'compliance', '2026-01-01', 'one_time', 'FinCEN. Verificar estado actual del requisito (ha tenido cambios legales). Confirmar con asesor US.'),

    // Form 5472 (corporaciones con dueños extranjeros)
    ob('US', ['sti_usa','delca2'], 'Form 5472 — operaciones con partes relacionadas extranjeras', 'reporting', '2026-04-15', 'annual', 'IRS. Aplica a entidades US con propiedad extranjera ≥25%. Se presenta con el 1120.'),
  ]
}

async function ensureSeeded() {
  const existing = await listObligations()
  if (existing.length > 0) return existing
  const items = seed2026()
  const s = store()
  await Promise.all(items.map((ob) => s.setJSON(ob.id, ob)))
  // Devolvemos los items en memoria (evita el lag de consistencia de list()).
  return items.slice().sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))
}

export default async (req) => {
  const u = authUser(req)
  if (!u) return json({ error: 'No autorizado' }, 401)

  const url = new URL(req.url)

  if (req.method === 'GET') {
    // Re-seed forzado (idempotente por IDs deterministas): repuebla lo que falte.
    if (url.searchParams.get('reseed') === '1') {
      if (u.role !== 'ceo' && u.role !== 'admin') return json({ error: 'Solo el CEO puede recargar el catálogo' }, 403)
      const items = seed2026()
      const existing = await listObligations()
      const seen = new Set(existing.map((o) => o.id))
      const s = store()
      const toAdd = items.filter((o) => !seen.has(o.id))
      await Promise.all(toAdd.map((ob) => s.setJSON(ob.id, ob)))
      const all = [...existing, ...toAdd].sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))
      return json({ obligations: all, added: toAdd.length })
    }

    // Auto-siembra en el primer acceso: el catálogo "ya está ahí".
    let items = await ensureSeeded()

    const country = url.searchParams.get('country')
    const status = url.searchParams.get('status')
    const entity = url.searchParams.get('entity')
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
    const id = 'fiscal-custom-' + slug(body.country) + '-' + body.due_date + '-' + slug(body.obligation_name)
    const ob = {
      id,
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
    await store().delete(id)
    return json({ ok: true })
  }

  return json({ error: 'Método no permitido' }, 405)
}

// Organigrama de Superlikers. Vive en la variable de entorno ORG (privada),
// NUNCA en el repositorio (que es público) porque contiene nombres y correos.
//   ORG = JSON { "correo": { "n": "Nombre Apellido", "l": "correo_del_jefe" }, ... }
// La raíz (CEO) tiene "l": null.

function orgMap() {
  try { return JSON.parse(process.env.ORG || '{}') } catch { return {} }
}

function keyOf(map, email) {
  const e = String(email || '').toLowerCase()
  return Object.keys(map).find((k) => k.toLowerCase() === e) || null
}

// Lista de personas para el buscador de destinatarios: [{email, name, leader}]
export function roster() {
  const m = orgMap()
  return Object.keys(m)
    .map((e) => ({ email: e, name: m[e].n || e, leader: m[e].l ? String(m[e].l).toLowerCase() : null }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export function nameFor(email) {
  const m = orgMap(); const k = keyOf(m, email)
  return k ? (m[k].n || k) : null
}

export function leaderOf(email) {
  const m = orgMap(); const k = keyOf(m, email)
  return k && m[k].l ? String(m[k].l).toLowerCase() : null
}

// Cadena de jefes de `email` hacia arriba (transitiva, con guardas contra ciclos).
export function ancestorsOf(email) {
  const out = []; const seen = new Set(); let cur = leaderOf(email)
  while (cur && !seen.has(cur)) { seen.add(cur); out.push(cur); cur = leaderOf(cur) }
  return out
}

// ¿`viewer` está por encima de `person` en el organigrama (a cualquier nivel)?
export function isAncestor(viewer, person) {
  const v = String(viewer || '').toLowerCase()
  if (!v) return false
  return ancestorsOf(person).includes(v)
}

// ¿`email` tiene reportes directos (es líder de alguien)?
export function hasReports(email) {
  const e = String(email || '').toLowerCase(); const m = orgMap()
  return Object.keys(m).some((k) => String(m[k].l || '').toLowerCase() === e)
}

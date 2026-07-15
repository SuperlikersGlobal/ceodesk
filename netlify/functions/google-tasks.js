// GET  /api/google-tasks           -> tareas de Google Tasks del usuario
// POST /api/google-tasks           -> conectar/desconectar / crear / completar / editar / estado local
//
// Dos modos:
//   - CEO (Luis): modo "hub". Ve las 6 listas del hub compartido con LADCC
//     (contrato §3). Siempre conectado.
//   - Líder: modo "own". Ve/gestiona SUS propias listas de Google Tasks
//     (impersonando su propio correo). Requiere OPT-IN manual ("Conectar").
//   - Resto de miembros (sin equipo): sin acceso.
import { authUser, json } from './_lib/auth.js'
import { isCeo } from './_lib/users.js'
import {
  googleTasksEnabled, listTasks, createHubTask, completeHubTask, patchHubTask, HUB_LISTS, hubSubject,
} from './_lib/google-tasks.js'
import { saveGtaskOverlay, listGtaskOverlays, getUserPrefs, setUserPref } from './_lib/store.js'

// Estado que ve CeoDesk = Google (2 estados) + overlay local (En curso/Bloqueada).
function ceodeskStatus(t, overlay) {
  if (t.gstatus === 'completed') return 'done'
  const s = overlay && overlay.status
  if (s === 'doing' || s === 'blocked') return s
  return 'todo'
}

export default async (req) => {
  const u = authUser(req)
  if (!u) return json({ error: 'No autorizado' }, 401)
  const ceo = isCeo(u)
  // Solo el CEO y los líderes (con equipo / supervisión) usan Google Tasks.
  const leader = ceo || !!u.sup
  if (!leader) return json({ error: 'Sin acceso a Google Tasks' }, 403)
  if (!googleTasksEnabled()) return json({ enabled: false, connected: false, tasks: [] })

  try {
    return await handle(req, u, ceo)
  } catch (e) {
    return json({ error: 'Google Tasks no disponible ahora mismo.', detail: String(e.message || e).slice(0, 160) }, 502)
  }
}

async function handle(req, u, ceo) {
  const mode = ceo ? 'hub' : 'own'
  const subject = ceo ? hubSubject() : u.u
  const onlyHub = ceo
  // El CEO siempre está conectado (su hub). El líder debe hacer opt-in.
  const prefs = ceo ? { gtasksConnected: true } : await getUserPrefs(u.u)
  const connected = ceo ? true : !!prefs.gtasksConnected

  if (req.method === 'GET') {
    if (!connected) return json({ enabled: true, mode, connected: false, tasks: [] })
    const showCompleted = new URL(req.url).searchParams.get('completed') === '1'
    const [res, overlays] = await Promise.all([
      listTasks({ subject, onlyHub, showCompleted }),
      listGtaskOverlays(),
    ])
    const merged = (res.tasks || []).map((t) => {
      const ov = overlays[t.gid]
      return { ...t, status: ceodeskStatus(t, ov), area: (ov && ov.area) || null }
    })
    const lists = ceo ? HUB_LISTS : (res.lists || [])
    return json({ enabled: true, mode, connected: true, lists, tasks: merged })
  }

  if (req.method === 'POST') {
    let body
    try { body = await req.json() } catch { return json({ error: 'JSON inválido' }, 400) }
    const op = body.op

    // Opt-in / opt-out (solo líderes; el CEO no lo necesita).
    if (op === 'connect' || op === 'disconnect') {
      if (ceo) return json({ connected: true })
      const p = await setUserPref(u.u, { gtasksConnected: op === 'connect' })
      return json({ connected: !!p.gtasksConnected })
    }

    // A partir de aquí hace falta estar conectado.
    if (!connected) return json({ error: 'Conecta Google Tasks primero.' }, 409)

    if (op === 'create') {
      if (!body.title || !body.title.trim()) return json({ error: 'Falta el título de la tarea.' }, 400)
      // El marcador · meta (cat/imp/urg) es convención del hub de LADCC: solo el CEO.
      const meta = ceo ? { cat: body.cat || null, imp: body.imp || null, urg: body.urg || null } : null
      const out = await createHubTask({
        subject, onlyHub, title: body.title, description: body.description || '', meta,
        due: body.due || null, listName: body.listName || null,
      })
      if (!out.ok) return json({ error: 'No se pudo crear la tarea (' + out.reason + ').' }, 502)
      if (body.area) await saveGtaskOverlay(out.task.gid, { area: body.area, listId: out.task.listId })
      return json({ task: out.task }, 201)
    }

    if (op === 'complete') {
      if (!body.gid || !body.listId) return json({ error: 'Falta la tarea.' }, 400)
      const out = await completeHubTask({ subject, gid: body.gid, listId: body.listId })
      if (!out.ok) return json({ error: 'No se pudo completar (' + out.reason + ').' }, 502)
      await saveGtaskOverlay(body.gid, { status: 'done', listId: body.listId })
      return json({ task: out.task })
    }

    if (op === 'edit') {
      if (!body.gid || !body.listId) return json({ error: 'Falta la tarea.' }, 400)
      const out = await patchHubTask({
        subject, gid: body.gid, listId: body.listId,
        title: body.title, description: body.description,
        due: body.due === undefined ? undefined : (body.due || null),
      })
      if (!out.ok) return json({ error: 'No se pudo editar (' + out.reason + ').' }, 502)
      return json({ task: out.task })
    }

    // Estados que Google Tasks no representa: solo viven en el overlay local.
    if (op === 'start' || op === 'block' || op === 'resume') {
      if (!body.gid) return json({ error: 'Falta la tarea.' }, 400)
      const status = op === 'block' ? 'blocked' : 'doing'
      const ov = await saveGtaskOverlay(body.gid, { status, listId: body.listId || null })
      return json({ overlay: ov })
    }

    return json({ error: 'Operación no válida.' }, 400)
  }

  return json({ error: 'Método no permitido' }, 405)
}

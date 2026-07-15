// GET  /api/google-tasks           -> tareas de Luis en las 6 listas del hub (per-user)
// POST /api/google-tasks           -> crear / completar / editar / cambiar estado local
//
// Vista PER-USER (contrato §3): solo el CEO (Luis) ve/gestiona sus Google Tasks,
// porque la cuenta impersonada por el Service Account es la suya. El resto del
// equipo no tiene Google Tasks propias en este hub.
import { authUser, json } from './_lib/auth.js'
import { isCeo } from './_lib/users.js'
import {
  googleTasksEnabled, listHubTasks, createHubTask, completeHubTask, patchHubTask, HUB_LISTS,
} from './_lib/google-tasks.js'
import { getGtaskOverlay, saveGtaskOverlay, listGtaskOverlays } from './_lib/store.js'

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
  // Solo el CEO gestiona el hub de Google Tasks (vista per-user de Luis).
  if (!isCeo(u)) return json({ error: 'Sin acceso a Google Tasks' }, 403)
  if (!googleTasksEnabled()) return json({ enabled: false, tasks: [] })

  try {
    return await handle(req)
  } catch (e) {
    // Un fallo de Google no debe tumbar la app: se degrada con mensaje claro.
    return json({ error: 'Google Tasks no disponible ahora mismo.', detail: String(e.message || e).slice(0, 160) }, 502)
  }
}

async function handle(req) {
  if (req.method === 'GET') {
    const showCompleted = new URL(req.url).searchParams.get('completed') === '1'
    const [{ tasks }, overlays] = await Promise.all([
      listHubTasks({ showCompleted }),
      listGtaskOverlays(),
    ])
    const merged = tasks.map((t) => {
      const ov = overlays[t.gid]
      return { ...t, status: ceodeskStatus(t, ov), area: (ov && ov.area) || null }
    })
    return json({ enabled: true, lists: HUB_LISTS, tasks: merged })
  }

  if (req.method === 'POST') {
    let body
    try { body = await req.json() } catch { return json({ error: 'JSON inválido' }, 400) }
    const op = body.op

    if (op === 'create') {
      if (!body.title || !body.title.trim()) return json({ error: 'Falta el título de la tarea.' }, 400)
      const meta = { cat: body.cat || null, imp: body.imp || null, urg: body.urg || null }
      const out = await createHubTask({
        title: body.title, description: body.description || '', meta,
        due: body.due || null, listName: body.listName || null,
      })
      if (!out.ok) return json({ error: 'No se pudo crear la tarea (' + out.reason + ').' }, 502)
      if (body.area) await saveGtaskOverlay(out.task.gid, { area: body.area, listId: out.task.listId })
      return json({ task: out.task }, 201)
    }

    if (op === 'complete') {
      if (!body.gid || !body.listId) return json({ error: 'Falta la tarea.' }, 400)
      const out = await completeHubTask({ gid: body.gid, listId: body.listId })
      if (!out.ok) return json({ error: 'No se pudo completar (' + out.reason + ').' }, 502)
      await saveGtaskOverlay(body.gid, { status: 'done', listId: body.listId })
      return json({ task: out.task })
    }

    if (op === 'edit') {
      if (!body.gid || !body.listId) return json({ error: 'Falta la tarea.' }, 400)
      const out = await patchHubTask({
        gid: body.gid, listId: body.listId,
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

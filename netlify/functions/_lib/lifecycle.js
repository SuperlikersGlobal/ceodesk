// Lógica pura del ciclo de vida de un ítem de trabajo.
// Sin dependencias de red/almacenamiento: fácil de testear.
//
// Cada TIPO de ítem tiene su propio conjunto de acciones y estados:
//   approve/sign/decide -> aprobar/firmar/decidir (Pendiente -> Aprobada/Firmada/Rechazada)
//   read                -> lectura (Pendiente -> Leída)
//   task                -> tarea (Por hacer -> En curso -> Hecha / Bloqueada)
import { randomUUID } from 'node:crypto'

export const REQUEST_TYPES = ['read', 'approve', 'sign', 'decide', 'task', 'bug']
export const PRIORITIES = ['low', 'medium', 'high', 'urgent']

// Estados en los que el ítem sigue abierto (esperando acción).
export const OPEN_STATUSES = ['pending', 'in_review', 'info_requested', 'todo', 'doing', 'blocked', 'open', 'resolved']

// Tipos que exigen "debido proceso" (contexto + recomendación + impacto).
export const DECISION_TYPES = ['approve', 'sign', 'decide']
export function isDecisionType(type) { return DECISION_TYPES.includes(type) }

// action -> nuevo estado
const ACTION_STATUS = {
  approve: 'approved',
  reject: 'rejected',
  sign: 'signed',
  mark_read: 'read',
  request_info: 'info_requested',
  provide_info: 'in_review',
  start: 'doing',
  complete: 'done',
  block: 'blocked',
  resume: 'doing',
  resolve: 'resolved',
  close: 'closed',
  reopen: 'open',
  cancel: 'cancelled',
  comment: null, // no cambia el estado
}

// action -> tipo de evento en el historial
const ACTION_EVENT = {
  approve: 'approved',
  reject: 'rejected',
  sign: 'signed',
  mark_read: 'read',
  request_info: 'info_requested',
  provide_info: 'info_provided',
  start: 'started',
  complete: 'completed',
  block: 'blocked',
  resume: 'resumed',
  resolve: 'resolved',
  close: 'closed',
  reopen: 'reopened',
  cancel: 'cancelled',
  comment: 'commented',
}

// Acciones por tipo de ítem, separadas por quién puede tomarlas.
// El solicitante siempre puede provide_info/cancel; cualquiera con acceso comenta.
const BY_TYPE = {
  approve: { assignee: ['approve', 'reject', 'request_info'], requester: [] },
  sign: { assignee: ['sign', 'reject', 'request_info'], requester: [] },
  decide: { assignee: ['approve', 'reject', 'request_info'], requester: [] },
  read: { assignee: ['mark_read'], requester: [] },
  task: { assignee: ['start', 'complete', 'block', 'resume'], requester: [] },
  bug: { assignee: ['start', 'resolve', 'block', 'resume'], requester: ['close', 'reopen'] },
}
const UNIVERSAL_ACTIONS = ['provide_info', 'cancel', 'comment']

// Todas las acciones del destinatario / del solicitante (para el control de acceso).
export const ASSIGNEE_ACTIONS = Array.from(new Set(Object.values(BY_TYPE).flatMap((t) => t.assignee)))
export const REQUESTER_ACTIONS = Array.from(new Set(['provide_info', 'cancel', ...Object.values(BY_TYPE).flatMap((t) => t.requester)]))
// Acciones que registran un desenlace (auditoría: quién y cuándo).
const RESOLUTION_ACTIONS = ['approve', 'reject', 'sign', 'complete', 'mark_read', 'resolve', 'close']

export function isOpen(status) {
  return OPEN_STATUSES.includes(status)
}

export function isValidAction(action) {
  return Object.prototype.hasOwnProperty.call(ACTION_EVENT, action)
}

// ¿La acción aplica a un ítem de este tipo?
export function isActionAllowedForType(action, type) {
  if (UNIVERSAL_ACTIONS.includes(action)) return true
  const t = BY_TYPE[type]
  if (!t) return false
  return t.assignee.includes(action) || t.requester.includes(action)
}

// Estado inicial según el tipo.
export function initialStatus(type) {
  if (type === 'task') return 'todo'
  if (type === 'bug') return 'open'
  return 'pending'
}

// Crea el ítem inicial (con evento 'created'). `input` ya viene validado.
// `assignee` = { email, name } de quien debe leer/aprobar/firmar/decidir/hacer.
export function buildRequest(input, code, requester, assignee, now = new Date().toISOString()) {
  const id = randomUUID()
  return {
    id,
    code,
    title: input.title,
    type: input.type,
    status: initialStatus(input.type),
    priority: input.priority || 'medium',
    requesterId: requester.email,
    requesterName: requester.name,
    requesterTitle: requester.title || null,
    assigneeId: assignee.email,
    assigneeName: assignee.name,
    area: input.area || null,
    labels: Array.isArray(input.labels) ? input.labels : [],
    context: input.context,
    recommendation: input.recommendation || null,
    impact: input.impact || null,
    documentName: input.documentName || null,
    documentUrl: input.documentUrl || null,
    documentVersion: input.documentVersion || null,
    dueDate: input.dueDate || null,
    createdAt: now,
    updatedAt: now,
    decidedAt: null,
    decidedByName: null,
    decisionNote: null,
    events: [
      { id: randomUUID(), actorId: requester.email, actorName: requester.name, type: 'created', note: null, createdAt: now },
    ],
  }
}

// Aplica una acción al ítem y devuelve la copia actualizada.
export function applyAction(req, action, actor, note, now = new Date().toISOString()) {
  if (!isValidAction(action)) throw new Error('Acción no válida')
  const next = { ...req, events: [...(req.events || [])] }
  const newStatus = ACTION_STATUS[action]
  if (newStatus) next.status = newStatus
  next.updatedAt = now
  if (RESOLUTION_ACTIONS.includes(action)) {
    next.decidedAt = now
    next.decidedByName = actor.name
    next.decisionNote = note || null
  }
  next.events.push({
    id: randomUUID(),
    actorId: actor.email,
    actorName: actor.name,
    type: ACTION_EVENT[action],
    note: note || null,
    createdAt: now,
  })
  return next
}

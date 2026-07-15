// Lógica pura del ciclo de vida de una solicitud de decisión.
// Sin dependencias de red/almacenamiento: fácil de testear.
import { randomUUID } from 'node:crypto'

export const REQUEST_TYPES = ['read', 'approve', 'sign', 'decide']
export const PRIORITIES = ['low', 'medium', 'high', 'urgent']
export const OPEN_STATUSES = ['pending', 'in_review', 'info_requested']

// action -> nuevo estado
const ACTION_STATUS = {
  approve: 'approved',
  reject: 'rejected',
  sign: 'signed',
  request_info: 'info_requested',
  provide_info: 'in_review',
  cancel: 'cancelled',
  comment: null, // no cambia el estado
}

// action -> tipo de evento en el historial
const ACTION_EVENT = {
  approve: 'approved',
  reject: 'rejected',
  sign: 'signed',
  request_info: 'info_requested',
  provide_info: 'info_provided',
  cancel: 'cancelled',
  comment: 'commented',
}

// Acciones reservadas al destinatario (quien debe leer/aprobar/firmar/decidir)
export const ASSIGNEE_ACTIONS = ['approve', 'reject', 'sign', 'request_info']
// Acciones del solicitante
export const REQUESTER_ACTIONS = ['provide_info', 'cancel']
// Acciones que registran una decisión final (auditoría / "firma")
const DECISION_ACTIONS = ['approve', 'reject', 'sign']

export function isOpen(status) {
  return OPEN_STATUSES.includes(status)
}

export function isValidAction(action) {
  return Object.prototype.hasOwnProperty.call(ACTION_EVENT, action)
}

// Crea la solicitud inicial (con evento 'created'). `input` ya viene validado.
// `assignee` = { email, name } del destinatario que debe leer/aprobar/firmar/decidir.
export function buildRequest(input, code, requester, assignee, now = new Date().toISOString()) {
  const id = randomUUID()
  return {
    id,
    code,
    title: input.title,
    type: input.type,
    status: 'pending',
    priority: input.priority || 'medium',
    requesterId: requester.email,
    requesterName: requester.name,
    requesterTitle: requester.title || null,
    assigneeId: assignee.email,
    assigneeName: assignee.name,
    context: input.context,
    recommendation: input.recommendation,
    impact: input.impact,
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

// Aplica una acción a la solicitud y devuelve la copia actualizada.
// Lanza Error con mensaje claro si la acción no es válida.
export function applyAction(req, action, actor, note, now = new Date().toISOString()) {
  if (!isValidAction(action)) throw new Error('Acción no válida')
  const next = { ...req, events: [...(req.events || [])] }
  const newStatus = ACTION_STATUS[action]
  if (newStatus) next.status = newStatus
  next.updatedAt = now
  if (DECISION_ACTIONS.includes(action)) {
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

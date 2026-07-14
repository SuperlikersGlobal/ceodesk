// Capa de acceso a datos. Una sola interfaz para toda la app; internamente usa
// Supabase (modo REAL) o un store local con datos de ejemplo (modo DEMO).

import { supabase, isDemo } from './supabase'
import { DEMO_PROFILES, DEMO_REQUESTS } from './mockData'
import type {
  DecisionRequest,
  EventType,
  Priority,
  Profile,
  RequestEvent,
  RequestStatus,
  RequestType,
} from './types'

export interface NewRequestInput {
  title: string
  type: RequestType
  priority: Priority
  context: string
  recommendation: string
  impact: string
  documentName?: string
  documentUrl?: string
  documentVersion?: string
  dueDate?: string
}

export type RequestAction =
  | 'approve'
  | 'reject'
  | 'sign'
  | 'request_info'
  | 'provide_info'
  | 'cancel'

const ACTION_TO_STATUS: Record<RequestAction, RequestStatus> = {
  approve: 'approved',
  reject: 'rejected',
  sign: 'signed',
  request_info: 'info_requested',
  provide_info: 'in_review',
  cancel: 'cancelled',
}

const ACTION_TO_EVENT: Record<RequestAction, EventType> = {
  approve: 'approved',
  reject: 'rejected',
  sign: 'signed',
  request_info: 'info_requested',
  provide_info: 'info_provided',
  cancel: 'cancelled',
}

// Acciones que representan una decisión final del CEO (registro de auditoría).
const DECISION_ACTIONS: RequestAction[] = ['approve', 'reject', 'sign']

// ---------------------------------------------------------------------------
// DEMO store (localStorage). Persiste las acciones durante la sesión de demo.
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'ceodesk_demo_requests_v1'

function loadDemo(): DecisionRequest[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as DecisionRequest[]
  } catch {
    /* ignore */
  }
  const seed = structuredClone(DEMO_REQUESTS)
  saveDemo(seed)
  return seed
}

function saveDemo(rows: DecisionRequest[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
  } catch {
    /* ignore */
  }
}

function nextCode(rows: DecisionRequest[]): string {
  const max = rows.reduce((m, r) => {
    const n = parseInt(r.code.replace(/\D/g, ''), 10)
    return Number.isFinite(n) ? Math.max(m, n) : m
  }, 100)
  return `CD-${max + 1}`
}

function uid(): string {
  return 'x-' + Math.random().toString(36).slice(2, 10)
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

export async function getProfiles(): Promise<Profile[]> {
  if (isDemo || !supabase) return structuredClone(DEMO_PROFILES)
  const { data, error } = await supabase.from('profiles').select('*').order('name')
  if (error) throw error
  return (data ?? []).map(mapProfile)
}

export async function listRequests(): Promise<DecisionRequest[]> {
  if (isDemo || !supabase) {
    return loadDemo().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
  const { data, error } = await supabase
    .from('requests')
    .select('*, events:request_events(*)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapRequest)
}

export async function getRequest(id: string): Promise<DecisionRequest | null> {
  if (isDemo || !supabase) {
    return loadDemo().find((r) => r.id === id) ?? null
  }
  const { data, error } = await supabase
    .from('requests')
    .select('*, events:request_events(*)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data ? mapRequest(data) : null
}

export async function createRequest(
  input: NewRequestInput,
  requester: Profile,
): Promise<DecisionRequest> {
  const nowIso = new Date().toISOString()

  if (isDemo || !supabase) {
    const rows = loadDemo()
    const id = uid()
    const req: DecisionRequest = {
      id,
      code: nextCode(rows),
      title: input.title,
      type: input.type,
      status: 'pending',
      priority: input.priority,
      requesterId: requester.id,
      requesterName: requester.name,
      requesterTitle: requester.title,
      context: input.context,
      recommendation: input.recommendation,
      impact: input.impact,
      documentName: input.documentName,
      documentUrl: input.documentUrl,
      documentVersion: input.documentVersion,
      dueDate: input.dueDate,
      createdAt: nowIso,
      updatedAt: nowIso,
      events: [
        {
          id: uid(),
          requestId: id,
          actorId: requester.id,
          actorName: requester.name,
          type: 'created',
          createdAt: nowIso,
        },
      ],
    }
    rows.unshift(req)
    saveDemo(rows)
    return req
  }

  const { data, error } = await supabase
    .from('requests')
    .insert({
      title: input.title,
      type: input.type,
      status: 'pending',
      priority: input.priority,
      requester_id: requester.id,
      context: input.context,
      recommendation: input.recommendation,
      impact: input.impact,
      document_name: input.documentName,
      document_url: input.documentUrl,
      document_version: input.documentVersion,
      due_date: input.dueDate,
    })
    .select('*, events:request_events(*)')
    .single()
  if (error) throw error
  return mapRequest(data)
}

export async function actOnRequest(
  id: string,
  action: RequestAction,
  actor: Profile,
  note?: string,
): Promise<DecisionRequest> {
  const status = ACTION_TO_STATUS[action]
  const eventType = ACTION_TO_EVENT[action]
  const isDecision = DECISION_ACTIONS.includes(action)
  const nowIso = new Date().toISOString()

  if (isDemo || !supabase) {
    const rows = loadDemo()
    const req = rows.find((r) => r.id === id)
    if (!req) throw new Error('Solicitud no encontrada')
    req.status = status
    req.updatedAt = nowIso
    if (isDecision) {
      req.decidedAt = nowIso
      req.decidedById = actor.id
      req.decidedByName = actor.name
      req.decisionNote = note
    }
    req.events.push({
      id: uid(),
      requestId: id,
      actorId: actor.id,
      actorName: actor.name,
      type: eventType,
      note,
      createdAt: nowIso,
    })
    saveDemo(rows)
    return req
  }

  const patch: Record<string, unknown> = { status, updated_at: nowIso }
  if (isDecision) {
    patch.decided_at = nowIso
    patch.decided_by_id = actor.id
    patch.decision_note = note ?? null
  }
  const { error: upErr } = await supabase.from('requests').update(patch).eq('id', id)
  if (upErr) throw upErr
  const { error: evErr } = await supabase.from('request_events').insert({
    request_id: id,
    actor_id: actor.id,
    type: eventType,
    note: note ?? null,
  })
  if (evErr) throw evErr
  const updated = await getRequest(id)
  if (!updated) throw new Error('Solicitud no encontrada')
  return updated
}

export async function addComment(
  id: string,
  actor: Profile,
  note: string,
): Promise<DecisionRequest> {
  const nowIso = new Date().toISOString()
  if (isDemo || !supabase) {
    const rows = loadDemo()
    const req = rows.find((r) => r.id === id)
    if (!req) throw new Error('Solicitud no encontrada')
    req.updatedAt = nowIso
    req.events.push({
      id: uid(),
      requestId: id,
      actorId: actor.id,
      actorName: actor.name,
      type: 'commented',
      note,
      createdAt: nowIso,
    })
    saveDemo(rows)
    return req
  }
  const { error } = await supabase.from('request_events').insert({
    request_id: id,
    actor_id: actor.id,
    type: 'commented',
    note,
  })
  if (error) throw error
  const updated = await getRequest(id)
  if (!updated) throw new Error('Solicitud no encontrada')
  return updated
}

// Reinicia el store de demo a los datos de ejemplo originales.
export function resetDemo() {
  if (isDemo) {
    localStorage.removeItem(STORAGE_KEY)
  }
}

// ---------------------------------------------------------------------------
// Mappers (snake_case de Postgres -> camelCase del dominio)
// ---------------------------------------------------------------------------

interface DbProfile {
  id: string
  name: string
  email: string
  role: string
  title: string | null
}

function mapProfile(row: DbProfile): Profile {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as Profile['role'],
    title: row.title ?? undefined,
  }
}

interface DbEvent {
  id: string
  request_id: string
  actor_id: string
  actor_name: string | null
  type: string
  note: string | null
  created_at: string
}

function mapEvent(row: DbEvent): RequestEvent {
  return {
    id: row.id,
    requestId: row.request_id,
    actorId: row.actor_id,
    actorName: row.actor_name ?? 'Usuario',
    type: row.type as EventType,
    note: row.note ?? undefined,
    createdAt: row.created_at,
  }
}

interface DbRequest {
  id: string
  code: string
  title: string
  type: string
  status: string
  priority: string
  requester_id: string
  requester_name: string | null
  requester_title: string | null
  context: string
  recommendation: string
  impact: string
  document_name: string | null
  document_url: string | null
  document_version: string | null
  due_date: string | null
  created_at: string
  updated_at: string
  decided_at: string | null
  decided_by_id: string | null
  decided_by_name: string | null
  decision_note: string | null
  events: DbEvent[] | null
}

function mapRequest(row: DbRequest): DecisionRequest {
  const events = (row.events ?? [])
    .map(mapEvent)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    type: row.type as RequestType,
    status: row.status as RequestStatus,
    priority: row.priority as Priority,
    requesterId: row.requester_id,
    requesterName: row.requester_name ?? 'Solicitante',
    requesterTitle: row.requester_title ?? undefined,
    context: row.context,
    recommendation: row.recommendation,
    impact: row.impact,
    documentName: row.document_name ?? undefined,
    documentUrl: row.document_url ?? undefined,
    documentVersion: row.document_version ?? undefined,
    dueDate: row.due_date ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    decidedAt: row.decided_at ?? undefined,
    decidedById: row.decided_by_id ?? undefined,
    decidedByName: row.decided_by_name ?? undefined,
    decisionNote: row.decision_note ?? undefined,
    events,
  }
}

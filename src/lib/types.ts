// Modelo de dominio de CeoDesk.
// Una "solicitud de decisión" es la unidad central: todo lo que requiere que el
// CEO lea, apruebe, firme o decida entra como una de estas, con contexto obligatorio.

export type UserRole = 'ceo' | 'leader' | 'member'

export type RequestType = 'read' | 'approve' | 'sign' | 'decide'

export type RequestStatus =
  | 'pending'        // esperando al CEO
  | 'in_review'      // el CEO la está revisando
  | 'info_requested' // el CEO pidió más información
  | 'approved'
  | 'rejected'
  | 'signed'
  | 'cancelled'

export type Priority = 'low' | 'medium' | 'high' | 'urgent'

export type EventType =
  | 'created'
  | 'commented'
  | 'info_requested'
  | 'info_provided'
  | 'approved'
  | 'rejected'
  | 'signed'
  | 'cancelled'
  | 'reminder_sent'

export interface Profile {
  id: string
  name: string
  email: string
  role: UserRole
  title?: string // cargo, ej. "Líder de Producto"
}

export interface RequestEvent {
  id: string
  requestId: string
  actorId: string
  actorName: string
  type: EventType
  note?: string
  createdAt: string // ISO
}

export interface DecisionRequest {
  id: string
  code: string // identificador legible, ej. CD-104
  title: string
  type: RequestType
  status: RequestStatus
  priority: Priority

  requesterId: string
  requesterName: string
  requesterTitle?: string

  // El "debido proceso": campos obligatorios para poder decidir bien.
  context: string          // qué es y por qué
  recommendation: string   // qué recomienda quien solicita
  impact: string           // qué pasa si se aprueba / si no

  documentUrl?: string
  documentName?: string
  documentVersion?: string // sobre qué versión se firma/aprueba

  dueDate?: string // ISO
  createdAt: string
  updatedAt: string

  // Registro interno de la decisión (auditoría).
  decidedAt?: string
  decidedById?: string
  decidedByName?: string
  decisionNote?: string

  events: RequestEvent[]
}

export const REQUEST_TYPE_LABEL: Record<RequestType, string> = {
  read: 'Lectura',
  approve: 'Aprobación',
  sign: 'Firma',
  decide: 'Decisión',
}

export const STATUS_LABEL: Record<RequestStatus, string> = {
  pending: 'Pendiente',
  in_review: 'En revisión',
  info_requested: 'Info solicitada',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  signed: 'Firmada',
  cancelled: 'Cancelada',
}

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  urgent: 'Urgente',
}

// Estados en los que la solicitud sigue esperando acción del CEO.
export const OPEN_STATUSES: RequestStatus[] = ['pending', 'in_review', 'info_requested']

export function isOpen(status: RequestStatus): boolean {
  return OPEN_STATUSES.includes(status)
}

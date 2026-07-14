import type {
  Priority,
  RequestStatus,
  RequestType,
} from '../lib/types'
import {
  PRIORITY_LABEL,
  REQUEST_TYPE_LABEL,
  STATUS_LABEL,
} from '../lib/types'
import { dueInfo, initials } from '../lib/format'

const STATUS_TONE: Record<RequestStatus, string> = {
  pending: 'amber',
  in_review: 'blue',
  info_requested: 'amber',
  approved: 'green',
  rejected: 'red',
  signed: 'green',
  cancelled: 'slate',
}

export function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span className={`badge badge--dot ${STATUS_TONE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  )
}

const TYPE_ICON: Record<RequestType, string> = {
  read: '👁',
  approve: '✅',
  sign: '✍️',
  decide: '⚖️',
}

export function TypeBadge({ type }: { type: RequestType }) {
  return (
    <span className="badge brand">
      {TYPE_ICON[type]} {REQUEST_TYPE_LABEL[type]}
    </span>
  )
}

const PRIORITY_COLOR: Record<Priority, string> = {
  low: 'var(--slate)',
  medium: 'var(--blue)',
  high: 'var(--amber)',
  urgent: 'var(--red)',
}

export function priorityColor(p: Priority): string {
  return PRIORITY_COLOR[p]
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const tone =
    priority === 'urgent'
      ? 'red'
      : priority === 'high'
        ? 'amber'
        : priority === 'medium'
          ? 'blue'
          : 'slate'
  return <span className={`badge ${tone}`}>{PRIORITY_LABEL[priority]}</span>
}

export function DueLabel({ dueDate }: { dueDate?: string }) {
  const info = dueInfo(dueDate)
  return <span className={`due ${info.tone}`}>{info.label}</span>
}

const AVATAR_COLORS = ['#4f46e5', '#0891b2', '#db2777', '#ea580c', '#16a34a', '#7c3aed']

export function Avatar({ name, size = 30 }: { name: string; size?: number }) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  const color = AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
  return (
    <span
      className="avatar"
      style={{ background: color, width: size, height: size, fontSize: size * 0.4 }}
      title={name}
    >
      {initials(name)}
    </span>
  )
}

import { Link } from 'react-router-dom'
import type { DecisionRequest } from '../lib/types'
import { relativeTime } from '../lib/format'
import { Avatar, DueLabel, StatusBadge, TypeBadge, priorityColor } from './ui'

export default function RequestRow({ req }: { req: DecisionRequest }) {
  return (
    <Link to={`/solicitud/${req.id}`} className="req-row">
      <span
        className="req-row__prio"
        style={{ background: priorityColor(req.priority) }}
        title={`Prioridad ${req.priority}`}
      />
      <Avatar name={req.requesterName} />
      <div className="req-row__main">
        <div className="req-row__title">
          <span className="req-row__code">{req.code}</span>
          {req.title}
        </div>
        <div className="req-row__meta">
          <span>{req.requesterName}</span>
          <span>·</span>
          <span>{relativeTime(req.createdAt)}</span>
          {req.documentName && (
            <>
              <span>·</span>
              <span>📎 {req.documentName}</span>
            </>
          )}
        </div>
      </div>
      <div className="req-row__side">
        <TypeBadge type={req.type} />
        <StatusBadge status={req.status} />
        <DueLabel dueDate={req.dueDate} />
      </div>
    </Link>
  )
}

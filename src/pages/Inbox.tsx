import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store'
import { isOpen, type RequestType } from '../lib/types'
import { REQUEST_TYPE_LABEL } from '../lib/types'
import RequestRow from '../components/RequestRow'

type Filter = 'all' | RequestType

const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 }

export default function Inbox() {
  const { requests, currentUser } = useStore()
  const [filter, setFilter] = useState<Filter>('all')

  const open = useMemo(
    () =>
      requests
        .filter((r) => isOpen(r.status))
        .sort((a, b) => {
          // Vencidas y urgentes primero; luego por fecha límite; luego por prioridad.
          const pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
          if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) {
            return a.dueDate.localeCompare(b.dueDate)
          }
          if (a.dueDate && !b.dueDate) return -1
          if (!a.dueDate && b.dueDate) return 1
          return pr
        }),
    [requests],
  )

  const counts = useMemo(() => {
    const overdue = open.filter((r) => r.dueDate && new Date(r.dueDate).getTime() < Date.now())
    const urgent = open.filter((r) => r.priority === 'urgent')
    const needInfo = open.filter((r) => r.status === 'info_requested')
    return { total: open.length, overdue: overdue.length, urgent: urgent.length, needInfo: needInfo.length }
  }, [open])

  const filtered = filter === 'all' ? open : open.filter((r) => r.type === filter)

  if (currentUser && currentUser.role !== 'ceo') {
    return (
      <div className="empty">
        <div className="empty__icon">🔒</div>
        <p>
          La bandeja de decisiones es del CEO. Como {currentUser.title ?? 'líder'}, revisa{' '}
          <Link to="/mis-solicitudes" className="link">
            Mis solicitudes
          </Link>{' '}
          o crea una{' '}
          <Link to="/nueva" className="link">
            Nueva solicitud
          </Link>
          .
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="page-head">
        <h1>Bandeja de decisiones</h1>
        <p>Todo lo que espera tu lectura, aprobación, firma o decisión, en un solo lugar.</p>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="stat__label">Pendientes</div>
          <div className="stat__value">{counts.total}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Vencidas</div>
          <div className={`stat__value ${counts.overdue ? 'danger' : ''}`}>{counts.overdue}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Urgentes</div>
          <div className={`stat__value ${counts.urgent ? 'warn' : ''}`}>{counts.urgent}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Esperan info tuya</div>
          <div className="stat__value">{counts.needInfo}</div>
        </div>
      </div>

      <div className="toolbar">
        <button
          className={`chip ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          Todas
        </button>
        {(Object.keys(REQUEST_TYPE_LABEL) as RequestType[]).map((t) => (
          <button
            key={t}
            className={`chip ${filter === t ? 'active' : ''}`}
            onClick={() => setFilter(t)}
          >
            {REQUEST_TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <div className="empty__icon">🎉</div>
          <p>No hay nada pendiente aquí. Bandeja al día.</p>
        </div>
      ) : (
        <div className="req-list">
          {filtered.map((r) => (
            <RequestRow key={r.id} req={r} />
          ))}
        </div>
      )}
    </>
  )
}

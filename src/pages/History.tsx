import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { isOpen, STATUS_LABEL, type RequestStatus } from '../lib/types'
import RequestRow from '../components/RequestRow'

type Filter = 'all' | 'resolved' | RequestStatus

export default function History() {
  const { requests } = useStore()
  const [filter, setFilter] = useState<Filter>('all')

  const resolved = useMemo(
    () =>
      requests
        .filter((r) => !isOpen(r.status))
        .sort((a, b) => (b.decidedAt ?? b.updatedAt).localeCompare(a.decidedAt ?? a.updatedAt)),
    [requests],
  )

  const stats = useMemo(() => {
    const signed = resolved.filter((r) => r.status === 'signed').length
    const approved = resolved.filter((r) => r.status === 'approved').length
    const rejected = resolved.filter((r) => r.status === 'rejected').length
    // Tiempo medio de decisión (días) entre creación y decisión.
    const decided = resolved.filter((r) => r.decidedAt)
    const avgDays =
      decided.length === 0
        ? 0
        : decided.reduce((sum, r) => {
            const d = new Date(r.decidedAt!).getTime() - new Date(r.createdAt).getTime()
            return sum + d / 86400000
          }, 0) / decided.length
    return { signed, approved, rejected, avgDays }
  }, [resolved])

  const filtered =
    filter === 'all' || filter === 'resolved'
      ? resolved
      : resolved.filter((r) => r.status === filter)

  return (
    <>
      <div className="page-head">
        <h1>Historial y auditoría</h1>
        <p>Registro trazable de cada decisión: quién, qué, cuándo y sobre qué versión.</p>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="stat__label">Firmadas</div>
          <div className="stat__value">{stats.signed}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Aprobadas</div>
          <div className="stat__value">{stats.approved}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Rechazadas</div>
          <div className="stat__value">{stats.rejected}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Tiempo medio decisión</div>
          <div className="stat__value">{stats.avgDays.toFixed(1)}<span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-muted)' }}> días</span></div>
        </div>
      </div>

      <div className="toolbar">
        <button className={`chip ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
          Todas
        </button>
        {(['signed', 'approved', 'rejected', 'cancelled'] as RequestStatus[]).map((s) => (
          <button key={s} className={`chip ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <div className="empty__icon">🗂️</div>
          <p>Aún no hay decisiones registradas.</p>
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

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store'
import { isOpen } from '../lib/types'
import RequestRow from '../components/RequestRow'

export default function MyRequests() {
  const { requests, currentUser } = useStore()

  const mine = useMemo(
    () =>
      requests
        .filter((r) => r.requesterId === currentUser?.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [requests, currentUser],
  )

  const open = mine.filter((r) => isOpen(r.status))
  const closed = mine.filter((r) => !isOpen(r.status))

  return (
    <>
      <div className="page-head">
        <h1>Mis solicitudes</h1>
        <p>Lo que le enviaste al CEO y en qué va cada cosa. Sin tener que perseguir por WhatsApp.</p>
      </div>

      {mine.length === 0 ? (
        <div className="empty">
          <div className="empty__icon">📭</div>
          <p>
            Aún no has creado solicitudes.{' '}
            <Link to="/nueva" className="link">
              Crea la primera
            </Link>
            .
          </p>
        </div>
      ) : (
        <>
          <h3 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--text-faint)', margin: '0 0 10px' }}>
            En curso ({open.length})
          </h3>
          <div className="req-list" style={{ marginBottom: 24 }}>
            {open.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>Nada en curso.</p>
            ) : (
              open.map((r) => <RequestRow key={r.id} req={r} />)
            )}
          </div>

          {closed.length > 0 && (
            <>
              <h3 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--text-faint)', margin: '0 0 10px' }}>
                Resueltas ({closed.length})
              </h3>
              <div className="req-list">
                {closed.map((r) => (
                  <RequestRow key={r.id} req={r} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </>
  )
}

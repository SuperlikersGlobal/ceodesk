import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store'
import { actOnRequest, addComment, getRequest, type RequestAction } from '../lib/api'
import {
  REQUEST_TYPE_LABEL,
  isOpen,
  type DecisionRequest,
  type EventType,
} from '../lib/types'
import { formatDate, formatDateTime, relativeTime } from '../lib/format'
import {
  Avatar,
  DueLabel,
  PriorityBadge,
  StatusBadge,
  TypeBadge,
} from '../components/ui'

const EVENT_LABEL: Record<EventType, string> = {
  created: 'creó la solicitud',
  commented: 'comentó',
  info_requested: 'pidió más información',
  info_provided: 'respondió con más información',
  approved: 'aprobó',
  rejected: 'rechazó',
  signed: 'firmó',
  cancelled: 'canceló',
  reminder_sent: 'recordatorio enviado',
}

const EVENT_ACCENT: Partial<Record<EventType, string>> = {
  approved: 'accent-green',
  signed: 'accent-green',
  rejected: 'accent-red',
  info_requested: 'accent-amber',
  created: 'accent-brand',
}

interface PendingAction {
  action: RequestAction
  title: string
  sub: string
  cta: string
  ctaClass: string
  requireNote?: boolean
}

export default function RequestDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentUser, refresh } = useStore()

  const [req, setReq] = useState<DecisionRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [comment, setComment] = useState('')

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      const r = id ? await getRequest(id) : null
      if (active) {
        setReq(r)
        setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [id])

  const isCeo = currentUser?.role === 'ceo'
  const isRequester = currentUser?.id === req?.requesterId
  const open = req ? isOpen(req.status) : false

  const ceoActions: PendingAction[] = useMemo(() => {
    if (!req) return []
    const list: PendingAction[] = []
    if (req.type === 'sign') {
      list.push({
        action: 'sign',
        title: `Firmar ${req.code}`,
        sub: `Se registrará tu firma sobre ${req.documentName ?? 'el documento'}${req.documentVersion ? ` (${req.documentVersion})` : ''} con sello de tiempo.`,
        cta: 'Firmar',
        ctaClass: 'btn--green',
      })
    } else {
      list.push({
        action: 'approve',
        title: `Aprobar ${req.code}`,
        sub: 'Quedará registrado como aprobado con tu nombre y fecha.',
        cta: 'Aprobar',
        ctaClass: 'btn--green',
      })
    }
    list.push({
      action: 'request_info',
      title: 'Pedir más información',
      sub: 'La solicitud vuelve a quien la pidió con tu pregunta.',
      cta: 'Enviar pregunta',
      ctaClass: 'btn--primary',
      requireNote: true,
    })
    list.push({
      action: 'reject',
      title: `Rechazar ${req.code}`,
      sub: 'Explica el motivo para que quede claro el porqué.',
      cta: 'Rechazar',
      ctaClass: 'btn--red',
      requireNote: true,
    })
    return list
  }, [req])

  async function runAction() {
    if (!req || !currentUser || !pending) return
    if (pending.requireNote && !note.trim()) return
    setBusy(true)
    try {
      const updated = await actOnRequest(req.id, pending.action, currentUser, note.trim() || undefined)
      setReq(updated)
      await refresh()
      setPending(null)
      setNote('')
    } finally {
      setBusy(false)
    }
  }

  async function submitComment() {
    if (!req || !currentUser || !comment.trim()) return
    setBusy(true)
    try {
      const updated = await addComment(req.id, currentUser, comment.trim())
      setReq(updated)
      setComment('')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="empty">Cargando…</div>
  if (!req) {
    return (
      <div className="empty">
        <div className="empty__icon">🔍</div>
        <p>No encontramos esa solicitud.</p>
        <Link to="/" className="link">
          Volver a la bandeja
        </Link>
      </div>
    )
  }

  return (
    <>
      <button className="back-link" onClick={() => navigate(-1)}>
        ← Volver
      </button>

      <div className="detail-grid">
        <div>
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              <TypeBadge type={req.type} />
              <StatusBadge status={req.status} />
              <PriorityBadge priority={req.priority} />
              <span className="req-row__code">{req.code}</span>
            </div>
            <h1 style={{ margin: '0 0 16px', fontSize: 22 }}>{req.title}</h1>

            <div className="detail-block">
              <h3>Contexto</h3>
              <p>{req.context}</p>
            </div>
            <div className="detail-block">
              <h3>Recomendación de quien solicita</h3>
              <p>{req.recommendation}</p>
            </div>
            <div className="detail-block">
              <h3>Impacto y urgencia</h3>
              <p>{req.impact}</p>
            </div>

            {req.documentName && (
              <div className="detail-block">
                <h3>Documento</h3>
                {req.documentUrl ? (
                  <a href={req.documentUrl} target="_blank" rel="noreferrer" className="doc-pill">
                    📄 {req.documentName}
                    {req.documentVersion ? ` · ${req.documentVersion}` : ''} ↗
                  </a>
                ) : (
                  <span className="doc-pill">
                    📄 {req.documentName}
                    {req.documentVersion ? ` · ${req.documentVersion}` : ''}
                  </span>
                )}
              </div>
            )}

            {req.decidedAt && (
              <div
                className="detail-block"
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: 14,
                  marginTop: 20,
                }}
              >
                <h3>Registro de la decisión</h3>
                <p style={{ fontWeight: 600 }}>
                  {req.status === 'signed'
                    ? 'Firmado'
                    : req.status === 'approved'
                      ? 'Aprobado'
                      : 'Rechazado'}{' '}
                  por {req.decidedByName} · {formatDateTime(req.decidedAt)}
                </p>
                {req.decisionNote && <p style={{ marginTop: 6 }}>“{req.decisionNote}”</p>}
              </div>
            )}
          </div>

          {/* Acciones del CEO */}
          {isCeo && open && (
            <div className="card" style={{ padding: 20, marginTop: 16 }}>
              <h3 style={{ margin: '0 0 10px', fontSize: 14 }}>Tu decisión</h3>
              <div className="actionbar">
                {ceoActions.map((a) => (
                  <button
                    key={a.action}
                    className={`btn ${a.ctaClass}`}
                    onClick={() => {
                      setPending(a)
                      setNote('')
                    }}
                  >
                    {a.cta}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Acción del solicitante cuando se pidió info */}
          {isRequester && req.status === 'info_requested' && (
            <div className="card" style={{ padding: 20, marginTop: 16 }}>
              <h3 style={{ margin: '0 0 10px', fontSize: 14 }}>El CEO pidió más información</h3>
              <textarea
                className="textarea"
                placeholder="Responde aquí para devolverla a su bandeja…"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <div style={{ marginTop: 10 }}>
                <button
                  className="btn btn--primary"
                  disabled={busy || !comment.trim()}
                  onClick={async () => {
                    if (!currentUser) return
                    setBusy(true)
                    try {
                      const updated = await actOnRequest(req.id, 'provide_info', currentUser, comment.trim())
                      setReq(updated)
                      await refresh()
                      setComment('')
                    } finally {
                      setBusy(false)
                    }
                  }}
                >
                  Responder y reenviar
                </button>
              </div>
            </div>
          )}

          {/* Comentario libre */}
          <div className="card" style={{ padding: 20, marginTop: 16 }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 14 }}>Añadir comentario</h3>
            <textarea
              className="textarea"
              placeholder="Escribe una nota para el hilo…"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <div style={{ marginTop: 10 }}>
              <button className="btn" disabled={busy || !comment.trim()} onClick={submitComment}>
                Comentar
              </button>
            </div>
          </div>
        </div>

        {/* Columna lateral */}
        <div>
          <div className="card" style={{ padding: 18 }}>
            <div className="kv">
              <span className="kv__k">Solicita</span>
              <span className="kv__v" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar name={req.requesterName} size={24} />
                {req.requesterName}
              </span>
            </div>
            {req.requesterTitle && (
              <div className="kv">
                <span className="kv__k">Cargo</span>
                <span className="kv__v">{req.requesterTitle}</span>
              </div>
            )}
            <div className="kv">
              <span className="kv__k">Tipo</span>
              <span className="kv__v">{REQUEST_TYPE_LABEL[req.type]}</span>
            </div>
            <div className="kv">
              <span className="kv__k">Creada</span>
              <span className="kv__v">{formatDate(req.createdAt)}</span>
            </div>
            <div className="kv">
              <span className="kv__k">Fecha límite</span>
              <span className="kv__v">
                <DueLabel dueDate={req.dueDate} />
              </span>
            </div>
          </div>

          <div className="card" style={{ padding: 18, marginTop: 16 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--text-faint)' }}>
              Historial
            </h3>
            <div className="timeline">
              {req.events.map((ev) => (
                <div key={ev.id} className={`tl-item ${EVENT_ACCENT[ev.type] ?? ''}`}>
                  <div className="tl-item__head">
                    <strong>{ev.actorName}</strong> {EVENT_LABEL[ev.type]}
                  </div>
                  <div className="tl-item__time">{formatDateTime(ev.createdAt)} · {relativeTime(ev.createdAt)}</div>
                  {ev.note && <div className="tl-item__note">{ev.note}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de confirmación de acción */}
      {pending && (
        <div className="modal-overlay" onClick={() => !busy && setPending(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{pending.title}</h2>
            <p className="modal__sub">{pending.sub}</p>
            <textarea
              className="textarea"
              placeholder={pending.requireNote ? 'Escribe el motivo / la pregunta…' : 'Nota (opcional)…'}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              autoFocus
            />
            <div className="modal__actions">
              <button className="btn" onClick={() => setPending(null)} disabled={busy}>
                Cancelar
              </button>
              <button
                className={`btn ${pending.ctaClass}`}
                onClick={runAction}
                disabled={busy || (pending.requireNote && !note.trim())}
              >
                {busy ? 'Guardando…' : pending.cta}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

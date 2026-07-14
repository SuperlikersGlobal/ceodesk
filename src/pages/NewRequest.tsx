import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { createRequest, type NewRequestInput } from '../lib/api'
import {
  PRIORITY_LABEL,
  REQUEST_TYPE_LABEL,
  type Priority,
  type RequestType,
} from '../lib/types'

const TYPE_ICON: Record<RequestType, string> = {
  read: '👁',
  approve: '✅',
  sign: '✍️',
  decide: '⚖️',
}

export default function NewRequest() {
  const { currentUser, refresh } = useStore()
  const navigate = useNavigate()

  const [type, setType] = useState<RequestType>('approve')
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [dueDate, setDueDate] = useState('')
  const [context, setContext] = useState('')
  const [recommendation, setRecommendation] = useState('')
  const [impact, setImpact] = useState('')
  const [documentName, setDocumentName] = useState('')
  const [documentUrl, setDocumentUrl] = useState('')
  const [documentVersion, setDocumentVersion] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const needsDoc = type === 'sign' || type === 'read'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!currentUser) return
    if (!title.trim() || !context.trim() || !recommendation.trim() || !impact.trim()) {
      setError('Completa los campos obligatorios: sin contexto, recomendación e impacto no se puede pedir una decisión.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      const input: NewRequestInput = {
        title: title.trim(),
        type,
        priority,
        context: context.trim(),
        recommendation: recommendation.trim(),
        impact: impact.trim(),
        documentName: documentName.trim() || undefined,
        documentUrl: documentUrl.trim() || undefined,
        documentVersion: documentVersion.trim() || undefined,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      }
      const created = await createRequest(input, currentUser)
      await refresh()
      navigate(`/solicitud/${created.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la solicitud.')
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>Nueva solicitud de decisión</h1>
        <p>Este es el único canal para pedirle algo al CEO. El contexto es obligatorio: así la decisión se toma con el debido proceso.</p>
      </div>

      <form className="card" style={{ padding: 24, maxWidth: 760 }} onSubmit={submit}>
        <div className="field">
          <label>¿Qué necesitas del CEO?</label>
          <div className="type-grid">
            {(Object.keys(REQUEST_TYPE_LABEL) as RequestType[]).map((t) => (
              <button
                type="button"
                key={t}
                className={`type-opt ${type === t ? 'active' : ''}`}
                onClick={() => setType(t)}
              >
                <span className="type-opt__icon">{TYPE_ICON[t]}</span>
                {REQUEST_TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor="title">Título *</label>
          <input
            id="title"
            className="input"
            placeholder="Ej. Contrato de alianza con RappiPay"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
          />
        </div>

        <div className="row-2">
          <div className="field">
            <label htmlFor="priority">Prioridad</label>
            <select
              id="priority"
              className="select"
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
            >
              {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="due">Fecha límite</label>
            <input
              id="due"
              type="date"
              className="input"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="context">Contexto: ¿qué es y por qué? *</label>
          <div className="hint">Da el trasfondo suficiente para decidir sin tener que preguntarte.</div>
          <textarea
            id="context"
            className="textarea"
            value={context}
            onChange={(e) => setContext(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="reco">Tu recomendación *</label>
          <div className="hint">¿Qué propones tú? No traigas solo el problema, trae tu propuesta.</div>
          <textarea
            id="reco"
            className="textarea"
            value={recommendation}
            onChange={(e) => setRecommendation(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="impact">Impacto y urgencia *</label>
          <div className="hint">¿Qué pasa si se aprueba? ¿Y si no se decide a tiempo?</div>
          <textarea
            id="impact"
            className="textarea"
            value={impact}
            onChange={(e) => setImpact(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="doc">
            Documento {needsDoc ? '' : '(opcional)'}
          </label>
          <input
            id="doc"
            className="input"
            placeholder="Nombre del archivo, ej. Contrato_RappiPay_v3.pdf"
            value={documentName}
            onChange={(e) => setDocumentName(e.target.value)}
          />
        </div>

        <div className="row-2">
          <div className="field">
            <label htmlFor="docurl">Enlace al documento (opcional)</label>
            <input
              id="docurl"
              className="input"
              placeholder="https://drive.google.com/…"
              value={documentUrl}
              onChange={(e) => setDocumentUrl(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="docver">Versión (opcional)</label>
            <input
              id="docver"
              className="input"
              placeholder="Ej. v3 (rev. legal 12-jul)"
              value={documentVersion}
              onChange={(e) => setDocumentVersion(e.target.value)}
            />
          </div>
        </div>

        {error && (
          <div className="banner" style={{ background: 'var(--red-soft)', color: '#b91c1c', borderColor: '#f6cccc' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting ? 'Enviando…' : 'Enviar solicitud'}
          </button>
          <button type="button" className="btn" onClick={() => navigate(-1)}>
            Cancelar
          </button>
        </div>
      </form>
    </>
  )
}

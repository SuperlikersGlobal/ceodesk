// Datos de demostración (modo DEMO). Se usan cuando no hay credenciales de
// Supabase configuradas, para poder ver y navegar CeoDesk sin backend.
// El contexto es ficticio pero verosímil para Superlikers.

import type { DecisionRequest, Profile, RequestEvent } from './types'

const DAY = 86400000
const now = Date.now()
const iso = (offsetDays: number) => new Date(now + offsetDays * DAY).toISOString()

export const DEMO_PROFILES: Profile[] = [
  { id: 'u-ceo', name: 'Luis (CEO)', email: 'luis@iwin.im', role: 'ceo', title: 'CEO' },
  { id: 'u-ana', name: 'Ana Restrepo', email: 'ana@superlikers.com', role: 'leader', title: 'Líder de Producto' },
  { id: 'u-carlos', name: 'Carlos Mejía', email: 'carlos@superlikers.com', role: 'leader', title: 'Líder Comercial' },
  { id: 'u-diana', name: 'Diana Gómez', email: 'diana@superlikers.com', role: 'leader', title: 'Líder de Finanzas' },
  { id: 'u-pablo', name: 'Pablo Ruiz', email: 'pablo@superlikers.com', role: 'member', title: 'Legal' },
]

function ev(
  requestId: string,
  actorId: string,
  actorName: string,
  type: RequestEvent['type'],
  offsetDays: number,
  note?: string,
): RequestEvent {
  return {
    id: `${requestId}-${type}-${offsetDays}`,
    requestId,
    actorId,
    actorName,
    type,
    note,
    createdAt: iso(offsetDays),
  }
}

export const DEMO_REQUESTS: DecisionRequest[] = [
  {
    id: 'r-104',
    code: 'CD-104',
    title: 'Contrato de alianza con RappiPay',
    type: 'sign',
    status: 'pending',
    priority: 'urgent',
    requesterId: 'u-carlos',
    requesterName: 'Carlos Mejía',
    requesterTitle: 'Líder Comercial',
    context:
      'Alianza comercial para integrar Superlikers en el programa de fidelización de RappiPay. Cerramos términos con su equipo y legal ya revisó el contrato. Falta tu firma para arrancar el piloto en agosto.',
    recommendation:
      'Firmar. Los términos son estándar, exclusividad de 6 meses solo en su vertical de pagos, sin penalidades de salida.',
    impact:
      'Si firmamos esta semana, entramos al ciclo de agosto (~1.2M usuarios). Si se retrasa, perdemos el trimestre y RappiPay evalúa a un competidor.',
    documentName: 'Contrato_RappiPay_v3.pdf',
    documentVersion: 'v3 (rev. legal 12-jul)',
    dueDate: iso(1),
    createdAt: iso(-2),
    updatedAt: iso(-2),
    events: [ev('r-104', 'u-carlos', 'Carlos Mejía', 'created', -2)],
  },
  {
    id: 'r-103',
    code: 'CD-103',
    title: 'Presupuesto de marketing Q3',
    type: 'approve',
    status: 'info_requested',
    priority: 'high',
    requesterId: 'u-ana',
    requesterName: 'Ana Restrepo',
    requesterTitle: 'Líder de Producto',
    context:
      'Plan de inversión de marketing para el tercer trimestre. Incluye pauta digital, eventos y contenido. Total: USD 85.000, un 15% por encima de Q2.',
    recommendation:
      'Aprobar el 80% ahora y dejar el 20% de eventos sujeto a resultados de julio.',
    impact:
      'Sostiene el ritmo de adquisición. Sin aprobación esta semana perdemos las tarifas preferenciales de pauta ya cotizadas.',
    documentName: 'Presupuesto_Mkt_Q3.xlsx',
    documentVersion: 'v2',
    dueDate: iso(3),
    createdAt: iso(-4),
    updatedAt: iso(-1),
    events: [
      ev('r-103', 'u-ana', 'Ana Restrepo', 'created', -4),
      ev('r-103', 'u-ceo', 'Luis (CEO)', 'info_requested', -1, '¿Cómo se compara el CAC proyectado vs Q2? Quiero verlo antes de aprobar.'),
    ],
  },
  {
    id: 'r-102',
    code: 'CD-102',
    title: 'Nueva política de trabajo remoto',
    type: 'decide',
    status: 'pending',
    priority: 'medium',
    requesterId: 'u-ana',
    requesterName: 'Ana Restrepo',
    requesterTitle: 'Líder de Producto',
    context:
      'Propuesta de esquema híbrido: 2 días presenciales obligatorios (martes y jueves). Encuestamos al equipo y el 78% está a favor.',
    recommendation:
      'Adoptar el esquema híbrido con revisión a los 3 meses.',
    impact:
      'Mejora percepción de cultura y retención. Requiere ajustar el contrato de la oficina (menos puestos fijos).',
    documentName: 'Politica_Remoto_2026.pdf',
    dueDate: iso(6),
    createdAt: iso(-3),
    updatedAt: iso(-3),
    events: [ev('r-102', 'u-ana', 'Ana Restrepo', 'created', -3)],
  },
  {
    id: 'r-101',
    code: 'CD-101',
    title: 'Renovación licencia infraestructura AWS',
    type: 'approve',
    status: 'pending',
    priority: 'high',
    requesterId: 'u-diana',
    requesterName: 'Diana Gómez',
    requesterTitle: 'Líder de Finanzas',
    context:
      'Renovación anual del compromiso de gasto con AWS (Savings Plan). USD 42.000 con 32% de descuento vs pago por demanda.',
    recommendation:
      'Aprobar. Ya validamos el consumo proyectado con el equipo técnico; el descuento se paga solo.',
    impact:
      'Ahorro de ~USD 20.000/año. La tarifa actual vence el 20 de julio.',
    documentName: 'AWS_SavingsPlan_2026.pdf',
    documentVersion: 'v1',
    dueDate: iso(4),
    createdAt: iso(-1),
    updatedAt: iso(-1),
    events: [ev('r-101', 'u-diana', 'Diana Gómez', 'created', -1)],
  },
  {
    id: 'r-100',
    code: 'CD-100',
    title: 'Memo estratégico: expansión a México',
    type: 'read',
    status: 'pending',
    priority: 'low',
    requesterId: 'u-carlos',
    requesterName: 'Carlos Mejía',
    requesterTitle: 'Líder Comercial',
    context:
      'Documento de análisis sobre la oportunidad de entrar al mercado mexicano en 2027. Es para tu lectura y comentarios, no requiere decisión aún.',
    recommendation:
      'Leer antes del comité del próximo mes para discutirlo con contexto.',
    impact: 'Base para la discusión estratégica del comité.',
    documentName: 'Memo_Mexico_2027.pdf',
    dueDate: iso(10),
    createdAt: iso(-5),
    updatedAt: iso(-5),
    events: [ev('r-100', 'u-carlos', 'Carlos Mejía', 'created', -5)],
  },
  {
    id: 'r-098',
    code: 'CD-098',
    title: 'Contrato laboral — Diseñador Sr.',
    type: 'sign',
    status: 'signed',
    priority: 'medium',
    requesterId: 'u-pablo',
    requesterName: 'Pablo Ruiz',
    requesterTitle: 'Legal',
    context: 'Contrato de la nueva contratación del equipo de diseño. Ya revisado por legal.',
    recommendation: 'Firmar; la persona arranca el 1 de agosto.',
    impact: 'Formaliza la contratación acordada.',
    documentName: 'Contrato_Disenador_Sr.pdf',
    documentVersion: 'v2',
    dueDate: iso(-1),
    createdAt: iso(-8),
    updatedAt: iso(-6),
    decidedAt: iso(-6),
    decidedById: 'u-ceo',
    decidedByName: 'Luis (CEO)',
    decisionNote: 'Firmado. Bienvenido al equipo.',
    events: [
      ev('r-098', 'u-pablo', 'Pablo Ruiz', 'created', -8),
      ev('r-098', 'u-ceo', 'Luis (CEO)', 'signed', -6, 'Firmado. Bienvenido al equipo.'),
    ],
  },
  {
    id: 'r-097',
    code: 'CD-097',
    title: 'Descuento especial cliente Bancolombia',
    type: 'decide',
    status: 'rejected',
    priority: 'high',
    requesterId: 'u-carlos',
    requesterName: 'Carlos Mejía',
    requesterTitle: 'Líder Comercial',
    context: 'Solicitud de un 40% de descuento para renovar a Bancolombia por 2 años.',
    recommendation: 'Aprobar el descuento para asegurar la renovación.',
    impact: 'Retiene la cuenta más grande, pero sienta un precedente de precio.',
    documentName: 'Propuesta_Bancolombia.pdf',
    createdAt: iso(-9),
    updatedAt: iso(-7),
    decidedAt: iso(-7),
    decidedById: 'u-ceo',
    decidedByName: 'Luis (CEO)',
    decisionNote: 'No a 40%. Ofrezcamos 25% + valor agregado (onboarding premium). Reunámonos para alinear.',
    events: [
      ev('r-097', 'u-carlos', 'Carlos Mejía', 'created', -9),
      ev('r-097', 'u-ceo', 'Luis (CEO)', 'rejected', -7, 'No a 40%. Ofrezcamos 25% + valor agregado.'),
    ],
  },
]

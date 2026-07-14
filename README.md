# CeoDesk

**Una única bandeja de decisiones, aprobaciones y firmas del CEO.**

Los líderes envían documentos que requieren lectura, aprobación, firma o una
decisión — y llegan por mail, WhatsApp y Google Chat, así que se pierden de
vista y toca perseguir. CeoDesk consolida todo eso en un solo lugar, con
estados, historial auditable, recordatorios y contexto obligatorio para
decidir bien.

## Cómo resuelve el problema

- **Bandeja única priorizada** — todo lo que espera al CEO en un solo tablero, ordenado por urgencia y fecha límite.
- **Un solo canal para pedir** — nadie pide una decisión por chat: se llena una *solicitud de decisión*.
- **Debido proceso obligatorio** — no se puede pedir una firma sin contexto, recomendación e impacto. El CEO decide informado.
- **Estados y trazabilidad** — `Pendiente → En revisión → Info solicitada → Aprobada / Rechazada / Firmada`, con historial por solicitud.
- **Registro interno de firma** — cada decisión queda con quién, cuándo y sobre qué versión del documento (auditoría).
- **Visibilidad para los líderes** — cada quien ve en qué va lo que envió, sin recordarle nada al CEO.

## Stack

- **Frontend:** React + TypeScript + Vite (una sola SPA, responsive para móvil).
- **Datos / auth / auditoría:** Supabase (PostgreSQL + RLS).
- **Hosting:** Netlify.

## Modos de ejecución

CeoDesk arranca en uno de dos modos según las variables de entorno:

| Modo | Cuándo | Qué hace |
|------|--------|----------|
| **Demo** | Sin credenciales de Supabase | Datos de ejemplo de Superlikers en memoria/localStorage. Ideal para ver y validar el flujo sin backend. |
| **Real** | Con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` | Usa Supabase de verdad (persistencia, auth, multiusuario). |

## Puesta en marcha

```bash
npm install
npm run dev        # http://localhost:5173  (modo demo si no hay .env)
```

En modo demo puedes cambiar de usuario (CEO / líder) con el selector arriba a la
derecha para ver ambas perspectivas.

### Conectar a Supabase (modo real)

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Ejecuta la migración `supabase/migrations/0001_init.sql` (SQL Editor o `supabase db push`).
3. Copia `.env.example` a `.env` y completa:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
4. Da de alta a tu equipo (Auth) y marca tu perfil con `role = 'ceo'` en la tabla `profiles`.

## Modelo de datos

- **profiles** — usuarios y su rol (`ceo` | `leader` | `member`).
- **requests** — la solicitud de decisión (tipo, estado, prioridad, contexto, recomendación, impacto, documento, fecha límite, registro de decisión).
- **request_events** — historial auditable (creación, comentarios, info solicitada/entregada, aprobación, rechazo, firma).

La seguridad se aplica con Row Level Security: todos ven las solicitudes, cada
quien crea las suyas y solo el CEO decide.

## Estructura

```
src/
  lib/        tipos, capa de datos (api), cliente Supabase, datos demo, formato
  components/ Layout, filas, badges/avatares
  pages/      Inbox, NewRequest, RequestDetail, MyRequests, History
supabase/
  migrations/ esquema SQL inicial
```

## Roadmap (siguientes fases)

- **Ingesta multicanal** — convertir correos de Gmail (y WhatsApp / Google Chat) en solicitudes.
- **Recordatorios automáticos** — Edge Function + cron que avisa por SLA al solicitante y al CEO.
- **Firma electrónica con validez legal** — integración tipo DocuSign para documentos que la requieran.
- **Delegación y umbrales** — aprobar por monto/tipo, con delegados.
- **Métricas** — tiempo medio de decisión, cuellos de botella, carga por líder.

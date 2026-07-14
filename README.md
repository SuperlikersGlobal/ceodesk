# CeoDesk

**Una única bandeja de decisiones, aprobaciones y firmas del CEO.**

Los líderes envían documentos que requieren lectura, aprobación, firma o una
decisión — y llegan por mail, WhatsApp y Google Chat, así que se pierden de
vista y toca perseguir. CeoDesk consolida todo eso en un solo lugar, con
estados, historial auditable y contexto obligatorio para decidir bien.

Producción: **https://ceodesk.superlikers.com**

## Cómo resuelve el problema

- **Bandeja única priorizada** — todo lo que espera al CEO en un tablero, ordenado por urgencia y fecha límite.
- **Un solo canal para pedir** — nadie pide una decisión por chat: se llena una *solicitud de decisión*.
- **Debido proceso obligatorio** — no se puede pedir una firma sin contexto, recomendación e impacto.
- **Estados y trazabilidad** — `Pendiente → En revisión → Info solicitada → Aprobada / Rechazada / Firmada`, con historial por solicitud.
- **Registro interno de firma** — cada decisión queda con quién, cuándo y sobre qué versión del documento.
- **Visibilidad para los líderes** — cada quien ve en qué va lo que envió, sin recordarle nada al CEO.

## Stack (100% Netlify, sin base de datos externa)

Mismo patrón que los demás proyectos del equipo (p. ej. `sl-crm-live`):

- **Frontend:** una SPA en `public/index.html` (HTML + CSS + JS vanilla, sin paso de build), responsive.
- **Backend:** **Netlify Functions** en `netlify/functions/`.
- **Datos:** **Netlify Blobs** (almacenamiento multiusuario incluido en Netlify).
- **Login:** **Google Sign-In** verificado con `google-auth-library`, restringido a `@iwin.im`.
- **Sesión:** token propio firmado con HMAC (`AUTH_SECRET`).

## Roles

- **CEO** (`CEO_EMAILS`, por defecto `luis@iwin.im`): ve la Bandeja y puede **aprobar, firmar, rechazar o pedir más información**.
- **Líderes** (cualquier `@iwin.im`): crean solicitudes, responden cuando el CEO pide info y siguen su estado.

## Estructura

```
public/index.html                 SPA completa (UI + router por hash + cliente API)
netlify/functions/
  config.js                       GET  /api/config          (clientId de Google + dominio)
  google-login.js                 POST /api/google-login     (credential -> token de sesión)
  requests.js                     GET/POST /api/requests      (listar / crear)
  request-action.js               POST /api/request-action    (aprobar/firmar/rechazar/pedir-info/responder/comentar)
  _lib/auth.js                    tokens HMAC + helpers
  _lib/google.js                  verificación del ID token de Google
  _lib/store.js                   acceso a Netlify Blobs (con fallback en memoria para tests)
  _lib/users.js                   alta automática por Google + roles
  _lib/lifecycle.js               lógica pura del ciclo de vida (testeable)
  _test/flow.test.js              prueba de integración del backend
netlify.toml                      publish=public, /api/* -> funciones, SPA fallback
```

## Configuración (Netlify → Site settings → Environment)

| Variable | Descripción |
|---|---|
| `GOOGLE_CLIENT_ID` | Client ID de Google (reutiliza el de tus otros proyectos). |
| `ALLOWED_DOMAIN` | Dominio permitido. Por defecto `iwin.im`. |
| `AUTH_SECRET` | Cadena larga y aleatoria para firmar los tokens de sesión. |
| `CEO_EMAILS` | Correos con rol de CEO (coma-separados). Por defecto `luis@iwin.im`. |
| `USER_TITLES` | (Opcional) JSON `{ "correo": "Cargo" }` para mostrar cargos. |

En Google Cloud, autoriza `https://ceodesk.superlikers.com` como *Authorized JavaScript origin* del Client ID.

## Desarrollo local

```bash
npm install
npm run dev        # netlify dev (funciones + Blobs local + estáticos)
```

Copia `.env.example` a `.env` y completa las variables. El login requiere un
`GOOGLE_CLIENT_ID` válido con `http://localhost:8888` autorizado.

## Pruebas

```bash
CEODESK_MEMORY_STORE=1 AUTH_SECRET=test CEO_EMAILS=luis@iwin.im npm test
```

Ejercita el ciclo completo (crear → pedir info → responder → firmar) y el
control de acceso por rol, usando un almacén en memoria (sin tocar Blobs real).

## Roadmap (siguientes fases)

- **Ingesta multicanal** — convertir correos de Gmail (y WhatsApp / Google Chat) en solicitudes.
- **Recordatorios automáticos por SLA** — función programada que avisa al solicitante y al CEO.
- **Firma electrónica con validez legal** — para documentos que la requieran.
- **Delegación y umbrales** · **métricas** de cuellos de botella y carga por líder.

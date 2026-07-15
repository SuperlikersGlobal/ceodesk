# CeoDesk

**Gestor de trabajo, decisiones y aprobaciones para Superlikers.**

Empezó resolviendo un problema del CEO —las solicitudes de lectura, aprobación,
firma o decisión llegaban dispersas por mail, WhatsApp y Google Chat y se
perdían— y evolucionó a una herramienta multiusuario donde **cualquiera puede
pedirle algo a cualquiera**, con visibilidad basada en el organigrama. Es, en
la práctica, un reemplazo básico de Jira para el equipo.

Producción: **https://ceodesk.superlikers.com**

## Qué hace

- **Solicitudes de cualquiera a cualquiera.** Cada ítem tiene un **destinatario**
  (elegido de un buscador con toda la gente). Las acciones las toma el
  destinatario, ya no solo el CEO.
- **Tipos de ítem, cada uno con su ciclo:**
  | Tipo | Ciclo |
  |---|---|
  | **Tarea** | Por hacer → En curso → Hecha (· Bloqueada) |
  | **Incidencia/Bug** | Abierta → En curso → Resuelta → Cerrada (la cierra quien reportó) |
  | **Aprobación** | Pendiente → Aprobada / Rechazada |
  | **Firma** | Pendiente → Firmada / Rechazada |
  | **Decisión** | Pendiente → Resuelta |
  | **Lectura** | Pendiente → Leída |
  El detalle muestra las acciones correctas por tipo (una tarea se *empieza/marca hecha*, no se *aprueba*).
- **Debido proceso** sólo donde toca: las decisiones exigen contexto +
  recomendación + impacto; las tareas/incidencias solo título + descripción.
- **Visibilidad por organigrama.** El solicitante y el destinatario siempre ven
  su ítem; un **líder ve lo que su equipo envía y lo que le asignan** (transitivo,
  todo su subárbol); el **Chief of Staff** ve todo lo asignado al CEO; el **CEO**
  ve todo. Más delegaciones manuales.
- **Áreas/Proyecto** y **Etiquetas** libres (con autocompletado) para clasificar
  y filtrar de forma transversal.
- **Tablero Kanban** (Tareas e Incidencias) con **arrastrar y soltar**, filtros
  por área/etiqueta/alcance y **vistas guardadas**.
- **Panel de métricas** (líderes y CEO): abiertos, vencidos, tiempo medio de
  resolución, cumplimiento de fecha, y carga por persona/área/tipo/estado.
- **Auditoría** completa por ítem (quién hizo qué y cuándo) y **registro interno
  de firma** (quién firmó, cuándo, sobre qué versión).

## Vistas

- **Mi trabajo** — todo lo asignado a mí (tareas + decisiones), priorizado.
- **Tablero** — Kanban de Tareas / Incidencias.
- **Supervisión** — el trabajo de mi equipo (líderes / Chief of Staff).
- **Nueva solicitud** — crear un ítem de cualquier tipo.
- **Mis solicitudes** — lo que yo envié y su estado.
- **Métricas** — panel de indicadores (líderes / CEO).
- **Historial** — decisiones cerradas, auditable.

## Stack (100% Netlify, sin base de datos externa)

Mismo patrón que los demás proyectos del equipo (p. ej. `sl-crm-live`):

- **Frontend:** SPA en `public/index.html` (HTML + CSS + JS vanilla, sin build), responsive.
- **Backend:** **Netlify Functions** (`netlify/functions/`).
- **Datos:** **Netlify Blobs** (almacenamiento multiusuario incluido en Netlify).
- **Login:** **Google Sign-In** verificado con `google-auth-library`, restringido a `@iwin.im`.
- **Sesión:** token propio firmado con HMAC (`AUTH_SECRET`).

## Estructura

```
public/index.html                 SPA completa (UI + router por hash + cliente API)
netlify/functions/
  config.js                       GET  /api/config          (clientId Google, dominio, áreas)
  google-login.js                 POST /api/google-login     (credential -> token de sesión)
  roster.js                       GET  /api/roster           (personas para elegir destinatario)
  requests.js                     GET/POST /api/requests      (listar según visibilidad / crear)
  request-action.js               POST /api/request-action    (acciones sobre un ítem)
  _lib/auth.js                    tokens HMAC + helpers
  _lib/google.js                  verificación del ID token de Google
  _lib/store.js                   Netlify Blobs (con fallback en memoria para tests)
  _lib/users.js                   alta por Google, roles, Chief of Staff, visibilidad
  _lib/org.js                     organigrama (ancestros, roster) desde la variable ORG
  _lib/lifecycle.js               tipos, estados, acciones y transiciones (lógica pura)
  _test/flow.test.js              pruebas de integración del backend
netlify.toml                      publish=public, /api/* -> funciones, SPA fallback
```

## Configuración (Netlify → Site settings → Environment)

| Variable | Descripción |
|---|---|
| `GOOGLE_CLIENT_ID` | Client ID de Google (autorizar los orígenes en Google Cloud). |
| `ALLOWED_DOMAIN` | Dominio permitido. Por defecto `iwin.im`. |
| `AUTH_SECRET` | Cadena larga y aleatoria para firmar los tokens de sesión. |
| `CEO_EMAILS` | Correos con rol de CEO (coma-separados). Por defecto `luis@iwin.im`. |
| `CHIEF_OF_STAFF` | Correo(s) que ven todo lo asignado al CEO. Ej.: `tatiana@iwin.im`. |
| `ORG` | Organigrama, JSON `{ "correo": { "n": "Nombre", "l": "correo_del_jefe" }, ... }`. La raíz tiene `"l": null`. **Contiene PII: solo en variable de entorno, nunca en el repo (que es público).** |
| `AREAS` | Lista de áreas/proyectos, coma-separada (ej. `Producto,Desarrollo,Diseño,…`). |
| `VIEWER_DELEGATIONS` | Delegaciones extra de visibilidad, JSON `{ "correo_delegado": ["correo1", …] }`. |
| `USER_TITLES` | (Opcional) JSON `{ "correo": "Cargo" }`. |

En Google Cloud, autoriza `https://ceodesk.superlikers.com` (y `https://ceodesk.netlify.app`) como *Authorized JavaScript origins* del Client ID.

> **Sesiones y cambios de organigrama:** el rol de supervisión se calcula al
> iniciar sesión. Tras cambiar `ORG` / `CHIEF_OF_STAFF` / `VIEWER_DELEGATIONS`,
> los usuarios afectados deben **cerrar sesión y volver a entrar** para ver las
> vistas nuevas. La visibilidad de los datos se aplica al instante.

## Desarrollo local

```bash
npm install
npm run dev        # netlify dev (funciones + Blobs local + estáticos)
```

Copia `.env.example` a `.env` y completa las variables. El login requiere un
`GOOGLE_CLIENT_ID` válido con `http://localhost:8888` autorizado.

## Pruebas

```bash
CEODESK_MEMORY_STORE=1 AUTH_SECRET=test node --test
```

Ejercita los ciclos de tarea, incidencia y decisión, la visibilidad por
organigrama, el Chief of Staff, la privacidad entre pares y las etiquetas,
usando un almacén en memoria (sin tocar Blobs real).

## Roadmap

- **Importar de Jira** — traer los issues abiertos para migrar de verdad
  (reutilizando la integración de Jira que ya existe en el CRM). *Pendiente.*
- Recordatorios automáticos por SLA · ingesta desde Gmail · firma electrónica
  con validez legal · más métricas (tiempo por estado, cuellos de botella).

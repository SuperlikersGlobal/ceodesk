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
- **Jira (espejo vivo, por usuario):** cualquier miembro puede **Conectar Jira**
  ("Conéctate con Atlassian", OAuth 2.0 3LO) y ver en "Mi trabajo" sus **issues
  asignados**, siempre al día (estado y datos reflejados desde Jira, con enlace al
  issue). Cada quien autoriza su propia cuenta; los tokens se guardan y refrescan
  por usuario.
- **Google Tasks como hub** (solo el CEO): "Mi trabajo" unifica los ítems nativos
  con las **6 listas de Google Tasks** de Luis (Superlikers · LADCC · DCDG · LIH ·
  La Isabella · DCC). Captura rápida, cambio de estado (En curso / Bloqueada,
  que solo viven en CeoDesk) y completar. Sincroniza con **LADCC Tasks** vía la
  API de Google, respetando el contrato: preserva la huella `· LADCC-XXXX`,
  escribe el marcador `· meta cat= imp= urg=` al crear, y mapea por Google-Task-ID.

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
  google-tasks.js                 GET/POST /api/google-tasks  (Google Tasks: hub CEO / propio líder)
  jira-connect.js                 GET  /api/jira-connect      (URL de autorización OAuth de Jira)
  jira-callback.js                GET  /api/jira-callback     (fin del OAuth: guarda tokens del usuario)
  jira.js                         GET/POST /api/jira          (espejo vivo de issues / desconectar)
  _lib/auth.js                    tokens HMAC + helpers
  _lib/google.js                  verificación del ID token de Google
  _lib/google-auth.js             cuenta de servicio + delegación de dominio (access token)
  _lib/google-tasks.js            integración Google Tasks (formato notes, huella, · meta)
  _lib/jira.js                    integración Jira (OAuth 3LO, mapeo de estados, proyección)
  _lib/store.js                   Netlify Blobs (con fallback en memoria para tests)
  _lib/users.js                   alta por Google, roles, Chief of Staff, visibilidad
  _lib/org.js                     organigrama (ancestros, roster) desde la variable ORG
  _lib/lifecycle.js               tipos, estados, acciones y transiciones (lógica pura)
  _test/flow.test.js              pruebas de integración del backend
  _test/gtasks.test.js            pruebas del contrato Google Tasks (huella, · meta, limpieza)
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
| `GOOGLE_SA_CLIENT_EMAIL` | (Opcional) Cuenta de servicio para Google Tasks. Se puede reutilizar la del CRM. |
| `GOOGLE_SA_PRIVATE_KEY` | (Opcional) Clave privada de la cuenta de servicio (con `\n` escapados). **Secreto.** |
| `GOOGLE_TASKS_IMPERSONATE` | (Opcional) Cuenta de Workspace a impersonar (dueña del hub). Por defecto, el 1er CEO. |
| `JIRA_OAUTH_CLIENT_ID` | (Opcional) Client ID de la app OAuth 2.0 (3LO) registrada en `developer.atlassian.com`. |
| `JIRA_OAUTH_CLIENT_SECRET` | (Opcional) Secret de la app OAuth de Jira. **Secreto.** |
| `APP_BASE_URL` | (Opcional) Base pública para el `redirect_uri` de Jira. Por defecto `https://ceodesk.superlikers.com`. |

En Google Cloud, autoriza `https://ceodesk.superlikers.com` (y `https://ceodesk.netlify.app`) como *Authorized JavaScript origins* del Client ID.

> **Sesiones y cambios de organigrama:** el rol de supervisión se calcula al
> iniciar sesión. Tras cambiar `ORG` / `CHIEF_OF_STAFF` / `VIEWER_DELEGATIONS`,
> los usuarios afectados deben **cerrar sesión y volver a entrar** para ver las
> vistas nuevas. La visibilidad de los datos se aplica al instante.

## Integración con Google Tasks (hub compartido con LADCC)

Google Tasks es el **hub** entre CeoDesk y LADCC Tasks: ambos leen y escriben
contra las 6 listas de Luis. CeoDesk es la interfaz principal de consulta; LADCC
(Sheet + Apps Script) es la fuente estructurada. El contrato completo vive en
`docs/INTEGRATION_GOOGLE_TASKS.md` del repo `luchodelcast/ladcc-tasks`.

Puntos clave de la implementación (no cambiar sin actualizar el contrato):

- **CEO (modo hub):** ve las 6 listas de Luis, sincronizadas con LADCC (siempre activo).
- **Líderes (modo propio, opt-in):** cada líder puede **Conectar Google Tasks** y ver/gestionar
  **sus propias listas** (se impersona su propio correo con el mismo Service Account; la
  delegación de dominio cubre a todo `@iwin.im`). No escriben el marcador `· meta` (es del hub).
  El opt-in se guarda por usuario en el store `ceodesk-prefs`. Los miembros sin equipo no acceden.
- **Autenticación:** cuenta de servicio con delegación de dominio, scope
  `auth/tasks`, impersonando `GOOGLE_TASKS_IMPERSONATE`. Se puede **reutilizar la
  misma cuenta de servicio del CRM** (el scope ya está autorizado en Workspace).
- **Formato de `notes`:** una sola línea de control al final. CeoDesk **preserva**
  la huella `· LADCC-XXXX` (nunca la inventa) y escribe `· meta cat= imp= urg=`
  al crear (valores con espacios → `_`). Al mostrar, limpia ambas líneas.
- **Mapeo por Google-Task-ID** (no por título) en un store aparte (`ceodesk-gtasks`),
  que guarda solo lo que Google Tasks no representa (estado En curso / Bloqueada).
- **Completar** = `status: completed`. Borrado: **no** se borra, solo se completa
  (evita que LADCC lo trate como "salió del filtro").

## Integración con Jira (espejo vivo por usuario)

Cada persona conecta **su propio** Jira con **OAuth 2.0 (3LO)** — el botón
"Conéctate con Atlassian". CeoDesk guarda su access/refresh token por usuario y
**refleja los issues asignados** (`assignee = currentUser()` abiertos) en "Mi
trabajo", con enlace directo al issue. Es lectura (Jira → CeoDesk); escribir de
vuelta a Jira queda para más adelante.

Puesta en marcha (una sola vez, quien administra):

1. En `https://developer.atlassian.com/console/myapps/` crea una **OAuth 2.0
   (3LO) integration**, tipo de acceso **Resource-level**.
2. **Permissions → Jira API**, con scopes `read:jira-work`, `read:jira-user`
   (opcional `write:jira-work` para el futuro). `offline_access` **no** se agrega
   aquí: va en el `scope` de la URL de autorización (lo pone el backend).
3. **Authorization → OAuth 2.0 (3LO)**, callback: `https://ceodesk.superlikers.com/api/jira-callback`.
4. Copia el **Client ID** y el **Secret** a las variables `JIRA_OAUTH_CLIENT_ID`
   y `JIRA_OAUTH_CLIENT_SECRET` (esta última, secreta) en Netlify.

El `state` del flujo va **firmado** (HMAC con `AUTH_SECRET`) y ata la autorización
al usuario. Los **rotating refresh tokens** se guardan en cada renovación, así el
espejo sigue vivo sin reconexiones. Los tokens viven en el store `ceodesk-jira`.

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
usando un almacén en memoria (sin tocar Blobs real). También valida los helpers
del contrato Google Tasks (huella `· LADCC-XXXX`, marcador `· meta`, limpieza de
la descripción) y los mapeos de Jira (estado/prioridad, proyección de issues,
URL de autorización y `state` firmado), todo sin tocar la red.

## Roadmap

- **Jira bidireccional** — cambiar el estado del issue *desde* CeoDesk (hoy el
  espejo es de lectura Jira → CeoDesk). Requiere transiciones por workflow.
- **Sincronización programada de Jira** — refrescar el espejo en segundo plano
  (hoy se refresca al abrir "Mi trabajo").
- Recordatorios automáticos por SLA · ingesta desde Gmail · firma electrónica
  con validez legal · más métricas (tiempo por estado, cuellos de botella).

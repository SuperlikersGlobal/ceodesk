import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useStore } from '../store'
import { isOpen } from '../lib/types'
import { isDemo } from '../lib/supabase'
import { Avatar } from './ui'

const PAGE_TITLES: Record<string, string> = {
  '/': 'Bandeja de decisiones',
  '/nueva': 'Nueva solicitud',
  '/mis-solicitudes': 'Mis solicitudes',
  '/historial': 'Historial y auditoría',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { currentUser, profiles, setCurrentUserId, requests } = useStore()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const isCeo = currentUser?.role === 'ceo'

  // Pendientes que esperan al CEO.
  const pendingForCeo = requests.filter((r) => isOpen(r.status)).length
  // Solicitudes abiertas creadas por el usuario actual (para líderes).
  const myOpen = requests.filter(
    (r) => r.requesterId === currentUser?.id && isOpen(r.status),
  ).length

  const title =
    PAGE_TITLES[location.pathname] ??
    (location.pathname.startsWith('/solicitud') ? 'Detalle de solicitud' : 'CeoDesk')

  return (
    <div className="app">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="sidebar__brand">
          <span className="sidebar__logo">C</span>
          CeoDesk
        </div>
        <nav className="sidebar__nav" onClick={() => setMenuOpen(false)}>
          {isCeo && (
            <NavLink to="/" end className="navlink">
              <span>📥</span> Bandeja
              {pendingForCeo > 0 && <span className="navlink__badge">{pendingForCeo}</span>}
            </NavLink>
          )}
          <NavLink to="/nueva" className="navlink">
            <span>➕</span> Nueva solicitud
          </NavLink>
          <NavLink to="/mis-solicitudes" className="navlink">
            <span>📤</span> Mis solicitudes
            {myOpen > 0 && <span className="navlink__badge">{myOpen}</span>}
          </NavLink>
          <NavLink to="/historial" className="navlink">
            <span>🗂️</span> Historial
          </NavLink>
        </nav>
        <div className="sidebar__foot">
          {isDemo ? 'Modo demo · datos de ejemplo' : 'Conectado a Supabase'}
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button
            className="btn btn--ghost btn--sm"
            style={{ display: 'none' }}
            id="menu-btn"
            onClick={() => setMenuOpen((o) => !o)}
          >
            ☰
          </button>
          <div className="topbar__title">{title}</div>
          <div className="topbar__spacer" />
          <div className="userswitch">
            {currentUser && <Avatar name={currentUser.name} />}
            <select
              value={currentUser?.id ?? ''}
              onChange={(e) => setCurrentUserId(e.target.value)}
              title="Ver la app como…"
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.role === 'ceo' ? 'CEO' : p.title ?? p.role}
                </option>
              ))}
            </select>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  )
}
